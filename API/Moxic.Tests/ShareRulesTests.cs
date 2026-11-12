using Moxic.Api.Services;
using Moxic.Shared.Enums;

namespace Moxic.Tests;

public class ShareRulesTests
{
    [Theory]
    [InlineData(900000, 50, 450000, 450000)]
    [InlineData(900000, 60, 540000, 360000)]
    [InlineData(1099000, 50, 550000, 549000)]
    [InlineData(1100000, 35, 385000, 715000)]
    [InlineData(999999, 10, 100999, 899000)]
    public void Split_rounds_to_thousand_and_sums_to_total(decimal total, int p, decimal owner, decimal partner)
    {
        var (a, b) = ShareRules.Split(total, p);
        Assert.Equal(owner, a);
        Assert.Equal(partner, b);
        Assert.Equal(total, a + b);
    }

    [Theory]
    [InlineData(10, true)]
    [InlineData(50, true)]
    [InlineData(90, true)]
    [InlineData(55, true)]
    [InlineData(5, false)]
    [InlineData(95, false)]
    [InlineData(52, false)]
    public void IsValidPercent(int p, bool ok) => Assert.Equal(ok, ShareRules.IsValidPercent(p));

    [Theory]
    [InlineData("CK MXR8F3K2Q1X nguyen van a", "MXR8F3K2Q1X")]
    [InlineData("mxr-8f3k2q1x", "MXR8F3K2Q1X")]
    [InlineData("MXS12345678", null)]
    [InlineData("MOXIC20261112ABCDE", null)]
    [InlineData(null, null)]
    public void FindPaymentCode(string? content, string? expected) => Assert.Equal(expected, ShareRules.FindPaymentCode(content));

    [Theory]
    [InlineData("Open", null, "waiting")]
    [InlineData("Full", null, "paying")]
    [InlineData("Funded", null, "full")]
    [InlineData("Funded", OrderStatus.Verifying, "full")]
    [InlineData("Funded", OrderStatus.Installing, "installing")]
    [InlineData("Funded", OrderStatus.ActionRequired, "installing")]
    [InlineData("Funded", OrderStatus.Completed, "done")]
    [InlineData("Funded", OrderStatus.Cancelled, "cancelled")]
    [InlineData("Cancelled", null, "cancelled")]
    public void DisplayStatus(string room, OrderStatus? order, string expected) =>
        Assert.Equal(expected, ShareRules.DisplayStatus(room, order));

    [Fact]
    public void Deadlines()
    {
        var t = new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal(t.AddHours(48), ShareRules.PayDeadline(t));
        Assert.Equal(t.AddHours(36), ShareRules.ReminderAt(t));
        Assert.Equal(t.AddDays(7), ShareRules.RoomExpiry(t));
    }
}
