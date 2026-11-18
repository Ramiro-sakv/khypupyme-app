using Microsoft.AspNetCore.Identity;

namespace KhypuPyme.Api.Accounts;

internal static class AuthErrors
{
    public static IResult Fail(string message, int status = 400) =>
        Results.Problem(statusCode: status, detail: message);

    public static IResult Identity(IdentityResult result)
    {
        var error = result.Errors.First().Code;
        var message = error switch
        {
            "PasswordTooShort" => "Usa al menos 12 caracteres para la contraseña.",
            "DuplicateEmail" or "DuplicateUserName" => "Este correo ya está registrado. Ingresa o recupera tu contraseña.",
            _ => "No se pudo completar la solicitud. Revisa los datos ingresados.",
        };
        return Fail(message);
    }
}
