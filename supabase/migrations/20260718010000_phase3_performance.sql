-- Phase 3: Performance Audit Indexes

-- Index on public.order_status_history for faster order detail loads
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- Index on public.order_status_history(created_at) for faster admin activity log loading
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON public.order_status_history(created_at DESC);

-- Index on public.visitor_sessions(last_seen) for fast cleanup sweeps and active count queries
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen ON public.visitor_sessions(last_seen);

-- Index on public.order_events(order_id) for faster client-side timeline loading
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
