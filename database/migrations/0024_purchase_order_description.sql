-- Add a description field to purchase orders so staff can explain what they need.
alter table purchase_orders add column description text;