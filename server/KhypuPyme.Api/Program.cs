using System.Text.Json.Serialization;
using KhypuPyme.Api.Accounts;
using KhypuPyme.Api.Businesses;
using KhypuPyme.Api.Billing;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Health;
using KhypuPyme.Api.Persistence;
using KhypuPyme.Api.Timber;
using KhypuPyme.Api.Retail;
using KhypuPyme.Api.Security;
using KhypuPyme.Api.Hosting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var provisionClients = args.Contains("--register-native-clients", StringComparer.Ordinal);
var migrate = args.Contains("--migrate-pilot", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(provisionClients || migrate ? [] : args);
var pilot = new PilotOptions(builder.Configuration, builder.Environment);
if (pilot.Enabled) builder.Configuration["AllowedHosts"] = pilot.Origin.Host + ";localhost;127.0.0.1";
builder.Services.AddSingleton(pilot);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<SafeErrors>();
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
if (pilot.Enabled) builder.Logging.AddFilter("OpenIddict", LogLevel.Error);
builder.Services.AddHttpClient("pilot-mail", client => client.Timeout = TimeSpan.FromSeconds(15))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);

var connectionString = builder.Configuration.GetConnectionString("KhypuPyme");
if (migrate) PilotOptions.RequireDatabase(connectionString, application: false);
builder.Services.AddDbContext<KhypuPymeDbContext>(options => options.UseNpgsql(connectionString));
builder.AddAccounts(pilot);
builder.Services.AddCors(options => options.AddPolicy("native", rule => rule
    .WithOrigins("https://localhost", "https://tauri.localhost")
    .WithMethods("GET", "POST", "PUT").WithHeaders("Authorization", "Content-Type")));
var renderProxy = pilot.Enabled && builder.Configuration.GetValue<bool>("Pilot:UseRenderProxy");
if (renderProxy)
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
builder.Services.AddScoped<BusinessAccess>();
builder.Services.AddScoped<LicenseAccess>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<CommerceService>();
builder.Services.AddScoped<CommerceReads>();
builder.Services.AddScoped<StoreReads>();
builder.Services.AddScoped<StockReads>();
builder.Services.AddScoped<TimberPracticeService>();
builder.Services.AddScoped<SecurityProofs>();
builder.Services.AddScoped<BusinessRemoval>();
builder.Services.AddScoped<AccountActions>();

var app = builder.Build();
if (migrate)
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<KhypuPymeDbContext>().Database.MigrateAsync();
    return;
}
if (provisionClients)
{
    if (!pilot.Native) throw new InvalidOperationException("Habilita el perfil de piloto o desarrollo.");
    await NativeAuthorization.RegisterClientsAsync(app.Services, app.Configuration);
    return;
}

if (pilot.Enabled)
{
    if (renderProxy) app.UseForwardedHeaders();
    app.Use(async (context, next) =>
    {
        var isDatabaseProbe = HttpMethods.IsGet(context.Request.Method) && context.Request.Path == "/api/v1/health/database";
        if (!isDatabaseProbe && (!context.Request.IsHttps ||
            !string.Equals(context.Request.Host.Host, pilot.Origin.Host, StringComparison.OrdinalIgnoreCase)))
        {
            context.Response.StatusCode = 400;
            return;
        }
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        await next();
    });
    await NativeAuthorization.RegisterClientsAsync(app.Services, app.Configuration);
}
app.UseExceptionHandler();
if (app.Environment.WebRootFileProvider.GetFileInfo("index.html").Exists) { app.UseDefaultFiles(); app.UseStaticFiles(); }
app.UseRouting();
app.UseCors("native");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.MapGroup("/api/v1/health").WithTags("Health").MapHealthEndpoints();
app.MapAccounts();
app.MapBusinesses();
app.MapBilling();
app.MapCommerce();
app.MapSecurity();
app.MapTimberPractice();
app.MapNativeAuthorization();
app.Run();
