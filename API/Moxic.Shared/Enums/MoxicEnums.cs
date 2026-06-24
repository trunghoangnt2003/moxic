namespace Moxic.Shared.Enums;

public enum GameStatus
{
    Available,
    Preorder
}

public enum OrderStatus
{
    Pending,
    AwaitingConfirmation,
    Verifying,
    Installing,
    ActionRequired,
    Completed,
    Cancelled
}

public enum PaymentMethod
{
    Bank,
    Crypto
}
