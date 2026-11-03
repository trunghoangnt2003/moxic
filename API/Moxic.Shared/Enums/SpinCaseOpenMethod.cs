namespace Moxic.Shared.Enums;

/// <summary>How a lucky-spin case ("hòm") is opened.</summary>
public enum SpinCaseOpenMethod
{
    /// <summary>Enter an admin-generated spin code. No login required.</summary>
    Code,

    /// <summary>Free once every N hours per verified customer account.</summary>
    FreeInterval,

    /// <summary>Costs N loyalty points, deducted atomically.</summary>
    Points
}
