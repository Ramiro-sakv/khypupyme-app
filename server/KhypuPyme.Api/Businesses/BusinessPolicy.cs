using System.Text.Json.Serialization;
using KhypuPyme.Api.Commerce;
using KhypuPyme.Api.Retail;

namespace KhypuPyme.Api.Businesses;

public sealed record OperatingPolicy(int Revision, string DefaultPayment, int MaxDiscountPercent,
    int QuoteDays, bool AllowNewCredit, int LotAlertDays);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record OperatingPolicyInput(
    [property: JsonRequired] int Revision,
    [property: JsonRequired] string DefaultPayment,
    [property: JsonRequired] int MaxDiscountPercent,
    [property: JsonRequired] int QuoteDays,
    [property: JsonRequired] bool AllowNewCredit,
    [property: JsonRequired] int LotAlertDays);

internal static class BusinessPolicy
{
    public const string DefaultPayment = "cash";
    public const int MaxDiscountPercent = 100;
    public const int QuoteDays = 7;
    public const int LotAlertDays = 30;

    public static async Task<Guid> UpdateAsync(CommerceTransaction work)
    {
        var input = work.Command.Policy ?? throw new CommerceFailure("Indica las reglas de operación.");
        if (input.DefaultPayment is not ("cash" or "qr" or "transfer") || input.MaxDiscountPercent is < 0 or > 100 ||
            input.QuoteDays is < 1 or > 90 || input.LotAlertDays is < 1 or > 90)
            throw new CommerceFailure("Revisa la forma de pago, el descuento máximo y los plazos de 1 a 90 días.");
        var settings = await work.SettingsAsync();
        if (input.Revision != settings.PolicyRevision)
            throw new CommerceFailure("La configuración cambió. Carga las reglas actuales antes de volver a guardarlas.", 409);
        if (!StoreProfiles.IsRetail(work.Business.Industry) && input.LotAlertDays != settings.LotAlertDays)
            throw new CommerceFailure("El plazo de vencimientos corresponde a rubros que controlan lotes.");

        settings.DefaultPayment = input.DefaultPayment;
        settings.MaxDiscountPercent = input.MaxDiscountPercent;
        settings.QuoteDays = input.QuoteDays;
        settings.AllowNewCredit = input.AllowNewCredit;
        settings.LotAlertDays = input.LotAlertDays;
        settings.PolicyRevision++;
        return settings.BusinessId;
    }
}
