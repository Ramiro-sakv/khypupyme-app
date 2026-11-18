namespace KhypuPyme.Api.Accounts;

public sealed class EmailChallenge
{
    public required string Email { get; init; }
    public required string Purpose { get; init; }
    public string ProtectedCode { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset[] SentAt { get; set; } = [];
    public int Attempts { get; set; }
    public bool Used { get; set; }
}
