This source monitors workflows running on the Otomato backend. It fetches workflow execution data and compares it with on-chain or external data to verify correctness.

- For EVERY_PERIOD: Checks if executions happen at the expected intervals.
- For TRANSFER: Fetches on-chain transfer events and ensures each has a corresponding execution.
- For STAKESTONE, BALANCE, PRICE: Fetches latest data; if there is a new data point, verifies that at least one execution occurred for it.

The goal is to detect missing or delayed executions and log errors for any mismatches.
