# F-8 variant schema (one JSON object per line, no line breaks inside)

Required keys, values from the enums where listed (pick exactly one enum value per enum key):

- id: "<angle-code>-<nnn>" e.g. "RG-001"
- name: short original name (2-5 words, no third-party names)
- format: roguelike_run | prediction_round | daily_puzzle | duel | league_season | calibration_drill | portfolio_sim | scenario_story | draft_deck | survival | sandbox | quiz | spectator
- data: hist_replay_masked (real historical price paths, ticker and dates hidden until the reveal) | hist_replay_named | synthetic_paths (generated, labelled as synthetic) | delayed_live (live prices delayed, resolved later) | live_eod_next_day (predict tomorrow's close direction, resolved at end of day) | verified_records_anon (anonymised closed trades from the app's own verified records) | mixed
- session_s: integer seconds, 45..900
- input: tap_up_down | swipe_lr | slider_prob | drag_range | hold_to_ride | multi_choice | allocation_sliders
- scoring: brier | log | interval_coverage | pnl_paper | rank_vs_field | risk_adjusted | streak_mult | hit_rate | brier_plus_paper
- progression: none | ladder_unlocks | seasonal_rating | skill_rating | cosmetic | knowledge_codex | ascension_modifiers | daily_only
- social: none | share_card | async_challenge_link | friends_league | global_leaderboard | ghost_race | spectate
- cadence: unlimited | daily_one | daily_three | weekly | energy_limited
- loop: the core loop in one sentence, <= 220 chars
- hook: why it is engaging and replayable, <= 160 chars
- risk: the main POLICY / compulsion / trust risk you see, <= 140 chars

Keep each line under ~700 bytes. Make all 100 lines genuinely distinct designs (different loops, not just
different enum values). Include some deliberately bold or risky ideas: later panels will filter them.

Binding rules for the text you write (POLICY T1/T2/P4/F1): no third-party company, product, app, game or
platform names, and no real people (describe genres generically: "a deck-building roguelike", "a word-a-day
puzzle"); no age cohorts that include minors (adults 18+ only); no phrasing that recommends buying or selling
anything. No real money or prizes in any design.
