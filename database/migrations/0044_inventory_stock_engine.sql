-- Make stock real, and close the routine-maintenance loop.
--
-- Until now, issuing parts (from the Store or a manual movement) logged an
-- inventory_movements row but never actually changed quantity_on_hand — the
-- client called an increment_inventory() RPC that was never created, so it
-- silently failed. Stock on hand was therefore fiction.
--
-- This makes every movement adjust stock automatically in the database (one
-- source of truth for all paths — manual, parts-request fulfilment, future
-- imports), and rolls the cost of parts issued against a work order straight
-- onto that Job Card.

create or replace function apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- quantity is stored signed: issues are negative, receipts/returns positive.
  update inventory_items
     set quantity_on_hand = coalesce(quantity_on_hand, 0) + NEW.quantity,
         updated_at = now()
   where id = NEW.inventory_item_id;

  -- Parts issued against a Job Card roll their cost onto that work order.
  if NEW.work_order_id is not null and NEW.movement_type = 'issue' then
    update work_orders
       set parts_cost = coalesce(parts_cost, 0) + coalesce(NEW.total_cost, 0),
           updated_at = now()
     where id = NEW.work_order_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_apply_inventory_movement on inventory_movements;
create trigger trg_apply_inventory_movement
  after insert on inventory_movements
  for each row execute function apply_inventory_movement();

-- Note: this applies to movements created from now on. Existing quantity_on_hand
-- values are left as they are (they'll be set correctly by the inventory import),
-- so historical movements are not retroactively re-applied.
