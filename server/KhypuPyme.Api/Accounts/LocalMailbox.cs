using System.Text.Json;

namespace KhypuPyme.Api.Accounts;

internal sealed class LocalMailbox(IWebHostEnvironment environment, IConfiguration configuration)
{
    public bool IsEnabled => environment.IsDevelopment();

    public async Task DeliverAsync(string email, string purpose, string code, CancellationToken ct)
    {
        if (!IsEnabled) throw new InvalidOperationException("El correo local solo está disponible en desarrollo.");

        var directory = configuration["Email:MailboxPath"] ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KhypuPyme2.0", "mailbox");
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, Guid.NewGuid().ToString("N") + ".json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(new { email, purpose, code }), ct);
    }
}
