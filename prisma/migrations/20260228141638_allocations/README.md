# Allocation-based payments

This migration introduces:

- `TransactionAllocation` to allocate a money `Transaction` across documents (e.g. `ClientInvoice`).
- `Receipt.transactionId` to link receipts to the underlying money transaction.

