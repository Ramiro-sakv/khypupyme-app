using System.Text.Json;
using System.Net.Http.Headers;
using KhypuPyme.Api.Hosting;

namespace KhypuPyme.Api.Accounts;

internal sealed class LocalMailbox(IWebHostEnvironment environment, IConfiguration configuration, PilotOptions pilot,
    IHttpClientFactory clients)
{
    public bool IsEnabled => pilot.Enabled || environment.IsDevelopment();

    public async Task DeliverAsync(string email, string purpose, string code, CancellationToken ct)
    {
        if (!IsEnabled) throw new InvalidOperationException("El correo no está configurado.");
        if (pilot.Enabled)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
            {
                Content = JsonContent.Create(new
                {
                    from = configuration["Mail:From"],
                    to = new[] { email },
                    subject = "Tu código de KhypuPyme",
                    text = "Tu código es " + code + "."
                })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", configuration["Mail:Token"]);
            try
            {
                using var response = await clients.CreateClient("pilot-mail").SendAsync(request, ct);
                if (!response.IsSuccessStatusCode) throw new IOException("Falló la entrega del correo del piloto.");
            }
            catch (HttpRequestException) { throw new IOException("Falló la entrega del correo del piloto."); }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            { throw new IOException("El correo del piloto no respondió a tiempo."); }
            return;
        }

        var directory = configuration["Email:MailboxPath"] ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KhypuPyme2.0", "mailbox");
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, Guid.NewGuid().ToString("N") + ".json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(new { email, purpose, code }), ct);
    }
}
