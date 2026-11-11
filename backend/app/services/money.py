"""Money helpers (Decimal-based, pure Python)."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CURRENCY_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}


def to_decimal(value) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid number: {value!r}") from exc
    if not d.is_finite():
        raise ValueError(f"Invalid number: {value!r}")
    return d


def q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calc_totals(items: list, tax_rate=0) -> dict:
    """items: [{description, quantity, unit_price}] -> rows + subtotal/tax/total (rounded to 2 dp)."""
    if not items:
        raise ValueError("At least one line item is required.")
    rows, subtotal = [], Decimal("0")
    for item in items:
        qty, price = to_decimal(item["quantity"]), to_decimal(item["unit_price"])
        if qty <= 0 or price < 0:
            raise ValueError("Quantity must be above zero and price cannot be negative.")
        amount = q2(qty * price)
        rows.append({"description": item["description"], "quantity": qty, "unit_price": q2(price), "amount": amount})
        subtotal += amount
    rate = to_decimal(tax_rate or 0)
    if rate < 0 or rate > 100:
        raise ValueError("Tax rate must be between 0 and 100.")
    tax = q2(subtotal * rate / Decimal(100))
    return {"items": rows, "subtotal": q2(subtotal), "tax_rate": rate, "tax_amount": tax, "total": q2(subtotal + tax)}


def format_money(amount, currency: str) -> str:
    symbol = CURRENCY_SYMBOLS.get((currency or "").upper())
    text = f"{float(amount):,.2f}"
    return f"{symbol}{text}" if symbol else f"{currency} {text}"
