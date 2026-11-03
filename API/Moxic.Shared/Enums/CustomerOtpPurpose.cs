namespace Moxic.Shared.Enums;

/// <summary>What a customer one-time code (OTP) is used for.</summary>
public enum CustomerOtpPurpose
{
    /// <summary>Confirms the customer owns the registered email address.</summary>
    EmailVerification,

    /// <summary>Authorizes a password reset (forgot-password flow).</summary>
    PasswordReset
}
