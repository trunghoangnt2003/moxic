namespace Moxic.Shared.Enums;

/// <summary>Lucky-spin prize kinds.</summary>
public enum SpinPrizeType
{
    /// <summary>"Chúc bạn may mắn lần sau" — no reward.</summary>
    Luck,

    /// <summary>Discount label (e.g. "Giảm 10%") — reward code issued, applied manually by admin.</summary>
    Discount,

    /// <summary>A store game — reward code issued, admin installs manually.</summary>
    Game
}
