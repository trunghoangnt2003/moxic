namespace Moxic.Core.Entities;

/// <summary>A support conversation between one visitor/customer and the shop.</summary>
public class ChatThread
{
    public Guid Id { get; set; }

    /// <summary>Short human code shown to admins (e.g. "K7Q2"), used for "/r CODE text" in Telegram.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>SHA-256 (hex) of the visitor's secret key (kept in their browser). Guests are identified only by this.</summary>
    public string AccessKeyHash { get; set; } = string.Empty;

    /// <summary>Signed-in customer (IdentityUser.Id), if any. No FK.</summary>
    public string? UserId { get; set; }

    public string? Name { get; set; }
    public string? Contact { get; set; }

    /// <summary>Order currently being discussed (latest one the customer attached).</summary>
    public string? OrderCode { get; set; }

    public int AdminUnread { get; set; }
    public int CustomerUnread { get; set; }

    // Dedicated Telegram forum topic for this conversation ("/tab"); deleted after /exit (+3h) or 24h idle.
    public long? TgTopicChatId { get; set; }
    public long? TgTopicId { get; set; }
    public DateTime? TgTopicCloseAt { get; set; }
    public DateTime LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid ThreadId { get; set; }
    public bool FromAdmin { get; set; }
    public string Text { get; set; } = string.Empty;

    /// <summary>Order the message was about (snapshot), so history can be filtered per order.</summary>
    public string? OrderCode { get; set; }

    /// <summary>"telegram" or "web" for admin replies.</summary>
    public string? Via { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Telegram message forwarded to an admin chat → thread, so a Telegram "Reply" finds its conversation.</summary>
public class ChatTelegramRef
{
    public long TelegramChatId { get; set; }
    public long TelegramMessageId { get; set; }
    public Guid ThreadId { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A Telegram chat (admin) linked to receive and answer support messages.</summary>
public class TelegramAdminChat
{
    public long ChatId { get; set; }
    public string? Name { get; set; }
    public DateTime LinkedAt { get; set; }

    /// <summary>Forum topic (message_thread_id) for order cards when the chat is a group with Topics.</summary>
    public long? OrdersTopicId { get; set; }

    /// <summary>Forum topic for customer chat messages.</summary>
    public long? ChatTopicId { get; set; }
}

/// <summary>An order card posted to an admin Telegram chat (edited in place when the order changes).</summary>
public class TelegramOrderMessage
{
    public long ChatId { get; set; }
    public long MessageId { get; set; }
    public Guid OrderId { get; set; }
    public DateTime CreatedAt { get; set; }
}
