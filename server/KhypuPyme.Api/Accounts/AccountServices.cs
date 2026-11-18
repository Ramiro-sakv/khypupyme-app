using System.Threading.RateLimiting;
using KhypuPyme.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Validation.AspNetCore;

namespace KhypuPyme.Api.Accounts;

internal static class AccountServices
{
    public static void AddAccounts(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var local = builder.Environment.IsDevelopment();
        var keyDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "KhypuPyme2.0", "keys");
        if (local)
        {
            var keys = services.AddDataProtection().SetApplicationName("KhypuPyme2.Local")
                .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));
            if (OperatingSystem.IsWindows()) keys.ProtectKeysWithDpapi();
        }
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<LocalMailbox>();
        services.AddScoped<EmailCodes>();
        services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-CSRF-TOKEN";
            options.Cookie.Name = "KhypuPyme2.Antiforgery";
            options.Cookie.SecurePolicy = local ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = 429;
            options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 90, Window = TimeSpan.FromMinutes(1) }));
        });

        services.AddIdentityCore<IdentityUser<Guid>>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.User.AllowedUserNameCharacters = string.Empty;
            options.SignIn.RequireConfirmedEmail = true;
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        }).AddEntityFrameworkStores<KhypuPymeDbContext>().AddSignInManager().AddDefaultTokenProviders();
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);

        var authentication = services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddPolicyScheme("AccountSession", "Cuenta web o instalada", options =>
            {
                options.ForwardDefaultSelector = http => http.Request.Headers.Authorization.Count != 0
                    ? OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme
                    : IdentityConstants.ApplicationScheme;
            });
        authentication.AddIdentityCookies();
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "KhypuPyme2.Session";
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = local ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            options.ExpireTimeSpan = TimeSpan.FromHours(12);
            options.SlidingExpiration = false;
            options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
            options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
        });

        if (GoogleFlow.IsEnabled(builder.Configuration))
        {
            authentication.AddGoogle(options =>
            {
                options.ClientId = builder.Configuration["Google:ClientId"]!;
                options.ClientSecret = builder.Configuration["Google:ClientSecret"]!;
                options.SignInScheme = IdentityConstants.ExternalScheme;
                options.ClaimActions.MapJsonKey(GoogleFlow.VerifiedEmailClaim, "verified_email");
                options.CorrelationCookie.SameSite = SameSiteMode.Lax;
                options.CorrelationCookie.SecurePolicy = local ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.Events.OnRemoteFailure = context =>
                {
                    context.HandleResponse();
                    context.Response.Redirect("/?auth=google-failed");
                    return Task.CompletedTask;
                };
            });
        }

        services.AddOpenIddict()
            .AddCore(options => options.UseEntityFrameworkCore().UseDbContext<KhypuPymeDbContext>().ReplaceDefaultEntities<Guid>())
            .AddServer(options =>
            {
                options.SetAuthorizationEndpointUris("/connect/authorize")
                    .SetTokenEndpointUris("/connect/token")
                    .SetRevocationEndpointUris("/connect/revoke")
                    .AllowAuthorizationCodeFlow().AllowRefreshTokenFlow()
                    .RequireProofKeyForCodeExchange()
                    .RegisterScopes("khypupyme_api")
                    .UseReferenceAccessTokens().UseReferenceRefreshTokens()
                    .SetAccessTokenLifetime(TimeSpan.FromMinutes(10))
                    .SetRefreshTokenLifetime(TimeSpan.FromDays(14))
                    .AddEphemeralEncryptionKey().AddEphemeralSigningKey();
                options.Configure(server => server.CodeChallengeMethods.Remove("plain"));

                var aspNet = options.UseAspNetCore().EnableAuthorizationEndpointPassthrough().EnableTokenEndpointPassthrough();
                if (local) aspNet.DisableTransportSecurityRequirement();
            })
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.AddAudiences("khypupyme_api");
                options.EnableTokenEntryValidation();
                options.UseAspNetCore();
            });
        services.AddAuthorizationBuilder()
            .AddPolicy("BrowserSession", policy => policy.RequireAuthenticatedUser().AddAuthenticationSchemes(IdentityConstants.ApplicationScheme))
            .AddPolicy("Account", policy => policy.RequireAuthenticatedUser().AddAuthenticationSchemes("AccountSession"));
    }
}
