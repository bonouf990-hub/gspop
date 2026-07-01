import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { BASE, COLORS, SHADOWS } from "../theme";

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  unit_of_measure: string | null;
};

type PartsRequestRow = {
  id: string;
  quantity: number;
  status: string;
  delivery_method: string;
  delivery_location: string | null;
  notes: string | null;
  created_at: string;
  inventory_items: { name: string; unit_of_measure: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  requested: COLORS.warning,
  approved: COLORS.info,
  picking: COLORS.goldSoft,
  delivering: COLORS.gold,
  delivered: COLORS.success,
  collected: COLORS.success,
  rejected: COLORS.danger,
};

export default function PartsRequest({
  workOrderId,
  tenantId,
}: {
  workOrderId: string;
  tenantId: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [deliveryMethod, setDeliveryMethod] = useState<"deliver" | "pickup">("deliver");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<PartsRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, [workOrderId]);

  async function loadRequests() {
    const { data } = await supabase
      .from("parts_requests")
      .select("id, quantity, status, delivery_method, delivery_location, notes, created_at, inventory_items(name, unit_of_measure)")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as unknown as PartsRequestRow[]);
    setLoading(false);
  }

  async function searchInventory(term: string) {
    setSearch(term);
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku, quantity_on_hand, unit_of_measure")
      .ilike("name", `%${term}%`)
      .gt("quantity_on_hand", 0)
      .limit(10);
    setItems((data ?? []) as InventoryItem[]);
  }

  async function handleSubmit() {
    if (!selectedItem) return;
    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("parts_requests").insert({
      tenant_id: tenantId,
      work_order_id: workOrderId,
      inventory_item_id: selectedItem.id,
      requested_by: userData.user?.id,
      quantity: Number(quantity),
      delivery_method: deliveryMethod,
      delivery_location: deliveryMethod === "deliver" ? deliveryLocation || null : null,
      notes: notes || null,
      status: "requested",
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setShowModal(false);
    setSelectedItem(null);
    setSearch("");
    setQuantity("1");
    setDeliveryLocation("");
    setNotes("");
    setItems([]);
    loadRequests();
  }

  return (
    <View style={BASE.card}>
      <Text style={BASE.goldLabel}>PARTS & MATERIALS</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} />
      ) : requests.length > 0 ? (
        <View style={s.requestList}>
          {requests.map((r) => {
            const item = r.inventory_items as { name: string; unit_of_measure: string | null } | null;
            return (
              <View key={r.id} style={s.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.requestItemName}>{item?.name ?? "Item"}</Text>
                  <Text style={s.requestDetail}>
                    Qty: {Number(r.quantity)} {item?.unit_of_measure ?? ""} ·{" "}
                    {r.delivery_method === "deliver" ? "Deliver" : "Pickup"}
                  </Text>
                  {r.delivery_location && (
                    <Text style={s.requestDetail}>📍 {r.delivery_location}</Text>
                  )}
                </View>
                <View style={[s.statusBadge, { borderColor: STATUS_COLORS[r.status] ?? COLORS.textMuted }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[r.status] ?? COLORS.textMuted }]}>
                    {r.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={s.emptyText}>No parts requested yet.</Text>
      )}

      <TouchableOpacity style={s.requestButton} onPress={() => setShowModal(true)} activeOpacity={0.7}>
        <Text style={s.requestButtonIcon}>🔧</Text>
        <Text style={s.requestButtonText}>Request Parts from Store</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Request Parts</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={s.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {!selectedItem ? (
              <>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search inventory…"
                  placeholderTextColor={COLORS.textMuted}
                  value={search}
                  onChangeText={searchInventory}
                  autoFocus
                />
                <FlatList
                  data={items}
                  keyExtractor={(i) => i.id}
                  style={s.searchResults}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.searchResultItem}
                      onPress={() => setSelectedItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{item.name}</Text>
                        {item.sku && <Text style={s.resultSku}>SKU: {item.sku}</Text>}
                      </View>
                      <View style={s.stockBadge}>
                        <Text style={s.stockText}>
                          {Number(item.quantity_on_hand)} {item.unit_of_measure ?? ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    search.length >= 2 ? (
                      <Text style={s.emptyText}>No items found in stock.</Text>
                    ) : (
                      <Text style={s.emptyText}>Type at least 2 characters to search.</Text>
                    )
                  }
                />
              </>
            ) : (
              <View style={s.formContainer}>
                <View style={s.selectedItemCard}>
                  <Text style={s.selectedItemName}>{selectedItem.name}</Text>
                  <Text style={s.selectedItemStock}>
                    In stock: {Number(selectedItem.quantity_on_hand)} {selectedItem.unit_of_measure ?? ""}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedItem(null)}>
                    <Text style={s.changeItem}>Change item</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.fieldLabel}>Quantity</Text>
                <TextInput
                  style={s.fieldInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={COLORS.textMuted}
                />

                <Text style={s.fieldLabel}>How do you want it?</Text>
                <View style={s.methodRow}>
                  <TouchableOpacity
                    style={[s.methodButton, deliveryMethod === "deliver" && s.methodActive]}
                    onPress={() => setDeliveryMethod("deliver")}
                  >
                    <Text style={[s.methodText, deliveryMethod === "deliver" && s.methodTextActive]}>
                      🚚 Deliver to me
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.methodButton, deliveryMethod === "pickup" && s.methodActive]}
                    onPress={() => setDeliveryMethod("pickup")}
                  >
                    <Text style={[s.methodText, deliveryMethod === "pickup" && s.methodTextActive]}>
                      🏪 I'll pick up
                    </Text>
                  </TouchableOpacity>
                </View>

                {deliveryMethod === "deliver" && (
                  <>
                    <Text style={s.fieldLabel}>Delivery Location</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={deliveryLocation}
                      onChangeText={setDeliveryLocation}
                      placeholder="e.g. Building A, Unit 304"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </>
                )}

                <Text style={s.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={[s.fieldInput, { minHeight: 60, textAlignVertical: "top" }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any special requirements…"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />

                <TouchableOpacity
                  style={[s.submitButton, submitting && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={s.submitButtonText}>
                    {submitting ? "Requesting…" : "Send Request to Store"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  requestList: { marginBottom: 12 },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  requestItemName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  requestDetail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", marginBottom: 12 },

  requestButton: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  requestButtonIcon: { fontSize: 16 },
  requestButtonText: { color: COLORS.gold, fontWeight: "700", fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    padding: 20,
    ...SHADOWS.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: COLORS.gold, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  closeButton: { color: COLORS.textSecondary, fontSize: 20, padding: 4 },

  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginBottom: 12,
  },
  searchResults: { maxHeight: 300 },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  resultName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  resultSku: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  stockBadge: {
    backgroundColor: COLORS.goldPale,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stockText: { color: COLORS.gold, fontSize: 12, fontWeight: "700" },

  formContainer: { paddingBottom: 20 },
  selectedItemCard: {
    backgroundColor: COLORS.goldPale,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  selectedItemName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700" },
  selectedItemStock: { color: COLORS.goldSoft, fontSize: 12, marginTop: 4 },
  changeItem: { color: COLORS.gold, fontSize: 12, fontWeight: "600", marginTop: 6 },

  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },

  methodRow: { flexDirection: "row", gap: 8 },
  methodButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  methodActive: {
    backgroundColor: COLORS.goldPale,
    borderColor: COLORS.gold,
  },
  methodText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  methodTextActive: { color: COLORS.gold },

  submitButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
    ...SHADOWS.elevated,
  },
  submitButtonText: { color: COLORS.background, fontWeight: "800", fontSize: 15 },
});
