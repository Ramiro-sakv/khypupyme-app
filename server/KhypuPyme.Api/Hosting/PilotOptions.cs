using System.Security.Cryptography.X509Certificates;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Npgsql;

namespace KhypuPyme.Api.Hosting;

internal sealed class PilotOptions(IConfiguration config, IWebHostEnvironment environment)
{
    private readonly HashSet<string> emails = (config["Pilot:AllowedEmails"] ?? "")
        .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public bool Enabled { get; } = config.GetValue<bool>("Pilot:Enabled");
    public bool Native => environment.IsDevelopment() || Enabled;
    public Uri Origin { get; } = ParseOrigin(config["Pilot:Origin"] ?? config["RENDER_EXTERNAL_URL"], config.GetValue<bool>("Pilot:Enabled"));
    public bool Allows(string? email) => !Enabled || email is not null && emails.Contains(email);

    public X509Certificate2 LoadCertificate()
    {
        if (emails.Count == 0 || string.IsNullOrWhiteSpace(config["Mail:Token"]) || string.IsNullOrWhiteSpace(config["Mail:From"]))
            throw new InvalidOperationException("Configura los correos invitados y el remitente del piloto.");
        RequireDatabase(config.GetConnectionString("KhypuPyme"), application: true);
        var encoded = config["Pilot:CertificateBase64"];
        var password = config["Pilot:CertificatePassword"];
        if (string.IsNullOrWhiteSpace(encoded) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Falta el certificado privado y su contraseña en la configuración del piloto.");
        return X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(encoded), password, X509KeyStorageFlags.EphemeralKeySet);
    }

    public static void RequireDatabase(string? value, bool application)
    {
        const string appRole = "khypupyme2_pilot_app";
        var connection = new NpgsqlConnectionStringBuilder(value);
        if (connection.SslMode != SslMode.VerifyFull || connection.Database != "khypupyme2_pilot" ||
            string.IsNullOrWhiteSpace(connection.Host) || connection.Host.Contains("-pooler", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("El piloto usa la conexión directa a khypupyme2_pilot con SSL Mode=VerifyFull.");
        if (string.IsNullOrWhiteSpace(connection.Username) || (connection.Username == appRole) != application)
            throw new InvalidOperationException(application
                ? "Render debe conectarse con khypupyme2_pilot_app."
                : "Para migrar el piloto usa la conexión del propietario de la base.");
    }

    private static Uri ParseOrigin(string? value, bool enabled)
    {
        if (!enabled) return new Uri("https://localhost");
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.UserInfo.Length != 0 || uri.PathAndQuery != "/" || uri.Fragment.Length != 0)
            throw new InvalidOperationException("Configura un origen HTTPS para el piloto.");
        return uri;
    }
}

internal sealed class PilotInvite : IAuthorizationRequirement;

internal sealed class PilotInviteHandler(PilotOptions pilot, UserManager<IdentityUser<Guid>> users) : AuthorizationHandler<PilotInvite>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PilotInvite requirement)
    {
        if (!pilot.Enabled) { context.Succeed(requirement); return; }
        var id = context.User.FindFirstValue("sub") ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is not null && await users.FindByIdAsync(id) is { EmailConfirmed: true } user && pilot.Allows(user.Email))
            context.Succeed(requirement);
    }
}
