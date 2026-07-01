-- Add unit cost to inventory items so parts issued carry a price
alter table inventory_items add column unit_cost numeric(12,2) default 0;

-- Add cost tracking to parts requests — auto-calculated on issue
alter table parts_requests add column unit_cost numeric(12,2);
alter table parts_requests add column total_cost numeric(12,2);

-- Track cost on inventory movements too
alter table inventory_movements add column unit_cost numeric(12,2);
alter table inventory_movements add column total_cost numeric(12,2);
