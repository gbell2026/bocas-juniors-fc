-- 'cancelled' is distinct from 'inactive' (which means "registered, not yet
-- activated" — see roster.ts) — it means an admin has deliberately removed
-- this player from active operation, reversible via restorePlayer().
alter type player_status add value 'cancelled';
