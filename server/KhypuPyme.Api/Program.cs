using KhypuPyme.Api.Health;
using KhypuPyme.Api.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("KhypuPyme");
builder.Services.AddDbContext<KhypuPymeDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGroup("/api/v1/health")
    .WithTags("Health")
    .MapHealthEndpoints();

app.Run();
