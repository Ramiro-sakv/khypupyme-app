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
using Microsoft.EntityFrameworkCore;

var provisionClients = args.Contains("--register-native-clients", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(provisionClients ? [] : args);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);

var connectionString = builder.Configuration.GetConnectionString("KhypuPyme");
builder.Services.AddDbContext<KhypuPymeDbContext>(options => options.UseNpgsql(connectionString));
builder.AddAccounts();
builder.Services.AddScoped<BusinessAccess>();
builder.Services.AddScoped<LicenseAccess>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<CommerceService>();
builder.Services.AddScoped<CommerceReads>();
builder.Services.AddScoped<StoreReads>();
builder.Services.AddScoped<TimberPracticeService>();
builder.Services.AddScoped<SecurityProofs>();
builder.Services.AddScoped<BusinessRemoval>();
builder.Services.AddScoped<AccountActions>();

var app = builder.Build();
if (provisionClients)
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("El registro actual es para el entorno local.");
    await NativeAuthorization.RegisterClientsAsync(app.Services, app.Configuration);
    return;
}

app.UseExceptionHandler();
app.UseRouting();
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
