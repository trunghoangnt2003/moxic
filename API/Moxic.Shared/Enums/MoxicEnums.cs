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
    Completed,
    Cancelled
}

public enum PaymentMethod
{
    Bank,
    Crypto
}
