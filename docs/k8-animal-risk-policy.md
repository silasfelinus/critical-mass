# K8 Wildlife: numeric meaning of animal levels

The 0–10 Wildlife dial is a **real, confirmed per-fund trading policy**,
not a personality quiz, score, predicted return, or probability of loss.

## Default ladder

Every positive animal level controls two independent behaviors:

1. **Buy-budget share:** an additional `maxDeploymentPercent` limit on
   **new** BTC/quote-currency buys. It is a percentage of the existing
   operator-controlled `maxUsdcDeployed` fund cap. It never raises that cap
   or modifies deposits, accounting principal, drawdown guards, or dry-run
   status. The engine enforces the lower number in reactive buys, ladder
   placement, manual ladder rebuilds, and risk-manager capacity checks.
2. **Trading aggressiveness:** the existing actual regime parameters
   interpolated from the configured conservative/moderate/aggressive/maximum
   presets. Relevant parameters include the volatility trigger, minimum
   entry interval, entry offsets, maximum cycle buys, and position multipliers.
   These are *strategy settings*, not guaranteed trade counts or timing.

The table below uses the **unmodified default presets**. If the operator
changes those global presets, the animal numbers keep their percentages,
but the specific intervals, offsets and buy limits update with them.
Each level can also have its own saved overrides in K8 Settings.

| Level | Animal | Max new-buy budget | Default minimum interval | Default maximum buys/cycle | Default entry offset |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | Anemone | Engine stop | N/A | N/A | N/A |
| 1 | Snail | 10% | 180 sec | 10 | 25 bps |
| 2 | Sloth | 20% | 160 sec | 12 | 23 bps |
| 3 | Tortoise | 30% | 140 sec | 13 | 20 bps |
| 4 | Capybara | 40% | 120 sec | 15 | 18 bps |
| 5 | Otter | 50% | 110 sec | 18 | 16 bps |
| 6 | Fox | 60% | 100 sec | 22 | 14 bps |
| 7 | Cheetah | 70% | 90 sec | 25 | 12 bps |
| 8 | Honey Badger | 80% | 80 sec | 33 | 10 bps |
| 9 | Phoenix | 90% | 70 sec | 42 | 7 bps |
| 10 | Dragon | 100% | 60 sec | 50 | 5 bps |

`bps` means basis points (100 bps = 1 percentage point).
A minimum interval only limits entry frequency; it is not a fixed buy
schedule. The buy limit caps orders *within one cycle*, not the total
number of transactions in a month.

For example, if the authorized fund cap is $100.15, default level 2
permits at most **$20.03** in new-buy exposure. Level 10 permits the
full $100.15. Trading can be *below* the cap due to minimum order size,
quote availability, volatility rules, liquidity checks, and existing orders.

## Settings and identity

- **Simple:** the chosen animal's 1–100% maximum deployment is editable.
  Its preview shows the corresponding dollar cap against the operator's
  original authorized fund ceiling.
- **Deep:** per-animal overrides for `kFactor`, `minIntervalMs`,
  `maxIntervalMs`, `entryOffsetBps`, `entryOffsetUpBps`,
  `entryOffsetDownBps`, `orderStaleMs`, `cautionScale`,
  `trendScale`, `maxCycleBuys` and `mergeProximityScale`.
- Overrides are stored in the separate K8 account record (not a device
  cookie); each is validated by the same engine preset/config contract.
  Deployment percentages must remain non-decreasing across the levels
  to preserve the basic meaning of lower versus higher animals.
- Saving a profile **does not apply** it to the engine. K8 must separately
  choose the animal and confirm the live configuration change. Admin
  may preview all choices but cannot mutate K8 risk from that screen.
  An unchanged profile can be restored to preset-derived defaults.
- Level 0 remains a **non-editable engine stop**, not a liquidation
  order, bank withdrawal, or guaranteed cancellation of open orders.

## Critical safety behaviors

A lower risk level does **not** automatically unwind existing holdings,
cancel existing resting entry orders, or reduce outstanding exposure.
After lowering the level, the engine blocks **new** buy exposure above the
new cap; previously placed orders can still fill. The UI shows current
deployed cost and outstanding buy-order count to make this visible.
An operator should inspect/cancel resting orders through the original
Critical Mass dashboard when immediate reduction is required.

The configured operator fund cap is the denominator, not verified
exchange deposits. The `maxDeploymentPercent` default of **100**
preserves historical behavior for **every fund that is not using K8**.

These tiers are convenience controls and intentionally do not equate
"10% exposed" with "10% probability of loss". Crypto can lose all value.
