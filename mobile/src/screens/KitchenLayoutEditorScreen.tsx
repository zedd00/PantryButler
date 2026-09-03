import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  createKitchenElement,
  createKitchenModel,
  createElementPlacement,
  deleteKitchenElement,
  deleteElementPlacementByItem,
  deleteKitchenModel,
  getAllEquipment,
  getKitchenElements,
  getKitchenModels,
  listPantry,
  updateKitchenElement,
  updateKitchenModel,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type {
  ElementItemPlacement,
  ElementType,
  Equipment,
  KitchenElementWithPlacements,
  KitchenModel,
  PantryItem,
  Shelf,
} from '../api/types';
import { ELEMENT_CONFIGS, ELEMENT_TYPES, elementColor, elementLabel } from '../lib/kitchenElements';
import { colors, radii, spacing } from '../theme';

type PlacedItem = { kind: 'ingredient' | 'equipment'; name: string; unit?: string; amount?: number | null };

export default function KitchenLayoutEditorScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const [models, setModels] = useState<KitchenModel[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [elements, setElements] = useState<KitchenElementWithPlacements[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [showNewModel, setShowNewModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [showAddElement, setShowAddElement] = useState(false);
  const [showElementEdit, setShowElementEdit] = useState(false);
  const [showPlaceItems, setShowPlaceItems] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);

  const client = session ? new ApiClient(session.serverUrl) : null;

  const loadModels = useCallback(async () => {
    if (!session || !client) return;
    try {
      const m = await getKitchenModels(client, session.apiToken, session.instanceId);
      setModels(m);
      setModelId((prev) => prev && m.some((x) => x.id === prev) ? prev : m[0]?.id ?? null);
    } catch {
      // best effort
    }
  }, [session, client]);

  const loadElements = useCallback(async () => {
    if (!session || !client || !modelId) {
      setElements([]);
      return;
    }
    setLoading(true);
    try {
      const [els, p, eq] = await Promise.all([
        getKitchenElements(client, session.apiToken, modelId),
        listPantry(client, session.apiToken, session.instanceId),
        getAllEquipment(client, session.apiToken, session.instanceId),
      ]);
      setElements(els);
      setPantry(p);
      setEquipment(eq);
      setSelectedElementId((prev) => prev && els.some((e) => e.id === prev) ? prev : els[0]?.id ?? null);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not load layout.');
    } finally {
      setLoading(false);
    }
  }, [session, client, modelId]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    loadElements();
  }, [loadElements]);

  const model = models.find((m) => m.id === modelId) ?? null;
  const selectedElement = elements.find((e) => e.id === selectedElementId) ?? null;

  const placedItemsFor = (el: KitchenElementWithPlacements): PlacedItem[] => {
    const placements = el.placements ?? [];
    const items: PlacedItem[] = [];
    for (const p of placements) {
      if (p.item_type === 'ingredient') {
        const pi = pantry.find((x) => x.id === p.item_id);
        if (pi) items.push({ kind: 'ingredient', name: pi.ingredient_name, unit: pi.unit, amount: Number(pi.amount) || 0 });
      } else {
        const eq = equipment.find((x) => x.id === p.item_id);
        if (eq) items.push({ kind: 'equipment', name: eq.name });
      }
    }
    return items;
  };

  const createModel = async () => {
    if (!session || !client || !newModelName.trim()) return;
    try {
      const m = await createKitchenModel(
        client,
        session.apiToken,
        { name: newModelName.trim(), canvas_width: 800, canvas_height: 600 },
        session.instanceId,
      );
      setNewModelName('');
      setShowNewModel(false);
      await loadModels();
      setModelId(m.id);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not create layout.');
    }
  };

  const doDeleteModel = (m: KitchenModel) => {
    if (!session || !client) return;
    Alert.alert('Delete layout', `Delete "${m.name}" and all its elements?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteKitchenModel(client, session.apiToken, m.id);
            await loadModels();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not delete.');
          }
        },
      },
    ]);
  };

  const addElement = async (type: ElementType) => {
    if (!session || !client || !modelId) return;
    try {
      const cfg = ELEMENT_CONFIGS[type];
      const spacing = 20;
      const count = elements.length;
      await createKitchenElement(client, session.apiToken, {
        model_id: modelId,
        element_type: type,
        x: Math.min(spacing + (count % 4) * 140, 600),
        y: spacing + Math.floor(count / 4) * 100,
        width: cfg.defaultWidth,
        height: cfg.defaultHeight,
      });
      setShowAddElement(false);
      await loadElements();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add element.');
    }
  };

  const deleteElement = (el: KitchenElementWithPlacements) => {
    if (!session || !client) return;
    Alert.alert('Remove element', `Remove "${elementLabel(el)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteKitchenElement(client, session.apiToken, el.id);
            await loadElements();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not remove.');
          }
        },
      },
    ]);
  };

  const placeItem = async (itemType: 'ingredient' | 'equipment', itemId: string) => {
    if (!session || !client || !selectedElementId) return;
    try {
      await createElementPlacement(client, session.apiToken, selectedElementId, itemType, itemId);
      setShowPlaceItems(false);
      await loadElements();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not place item.');
    }
  };

  const unplaceItem = (el: KitchenElementWithPlacements, placement: ElementItemPlacement) => {
    if (!session || !client) return;
    Alert.alert('Remove placement', 'Remove this item from the element?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteElementPlacementByItem(client, session.apiToken, el.id, placement.item_type, placement.item_id);
            await loadElements();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not remove.');
          }
        },
      },
    ]);
  };

  // Positioned element renderer (scaled canvas preview)
  const scaled = (value: number, canvasSize: number, containerSize: number) =>
    (value / canvasSize) * containerSize;

  const canvasDisplayWidth = useMemo(() => 320, []);
  const aspect = model ? model.canvas_height / model.canvas_width : 0.75;
  const canvasDisplayHeight = canvasDisplayWidth * aspect;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Layout</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowNewModel(true)} accessibilityRole="button">
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>New Layout</Text>
        </TouchableOpacity>
      </View>

      {models.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Ionicons name="grid-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyBig}>No kitchen layouts yet.</Text>
          <Text style={styles.emptySub}>Create a layout to organize where your food lives.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelBar}>
            {models.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelChip, m.id === modelId && styles.modelChipActive]}
                onPress={() => {
                  setModelId(m.id);
                  setSelectedElementId(null);
                }}
                onLongPress={() => doDeleteModel(m)}
                accessibilityRole="button"
              >
                <Text style={[styles.modelChipText, m.id === modelId && styles.modelChipTextActive]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {model ? (
            <>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.loader} />
              ) : (
                <>
                  <View style={styles.canvasWrap}>
                    <TouchableOpacity
                      style={[styles.canvas, { width: canvasDisplayWidth, height: canvasDisplayHeight }]}
                      activeOpacity={1}
                      onPress={() => setSelectedElementId(null)}
                    >
                      {elements.map((el) => {
                        const w = scaled(el.width, model.canvas_width, canvasDisplayWidth);
                        const h = scaled(el.height, model.canvas_height, canvasDisplayHeight);
                        const x = scaled(el.x, model.canvas_width, canvasDisplayWidth);
                        const y = scaled(el.y, model.canvas_height, canvasDisplayHeight);
                        const active = el.id === selectedElementId;
                        return (
                          <TouchableOpacity
                            key={el.id}
                            style={[
                              styles.canvasEl,
                              {
                                left: x,
                                top: y,
                                width: w,
                                height: h,
                                backgroundColor: elementColor(el),
                                borderColor: active ? colors.primary : '#00000033',
                                borderWidth: active ? 2 : 1,
                              },
                            ]}
                            onPress={() => setSelectedElementId(el.id)}
                            accessibilityRole="button"
                          >
                            <Text style={styles.canvasElText} numberOfLines={2}>
                              {elementLabel(el)}
                            </Text>
                            {(el.placements?.length ?? 0) > 0 ? (
                              <Text style={styles.canvasElCount}>{el.placements!.length}</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.toolRow}>
                    <TouchableOpacity style={[styles.toolBtn, styles.toolPrimary]} onPress={() => setShowAddElement(true)} accessibilityRole="button">
                      <Ionicons name="add-circle-outline" size={16} color={colors.white} />
                      <Text style={styles.toolPrimaryText}>Add Element</Text>
                    </TouchableOpacity>
                    {selectedElement ? (
                      <>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowBrowse(true)} accessibilityRole="button">
                          <Ionicons name="eye-outline" size={16} color={colors.primary} />
                          <Text style={styles.toolText}>Items</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowPlaceItems(true)} accessibilityRole="button">
                          <Ionicons name="arrow-down-circle-outline" size={16} color={colors.primary} />
                          <Text style={styles.toolText}>Place Item</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowElementEdit(true)} accessibilityRole="button">
                          <Ionicons name="options-outline" size={16} color={colors.primary} />
                          <Text style={styles.toolText}>Edit</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>

                  {selectedElement ? (
                    <View style={styles.selectionCard}>
                      <View style={styles.selectionHeader}>
                        <Ionicons name="cube-outline" size={18} color={colors.text} />
                        <Text style={styles.selectionTitle}>{elementLabel(selectedElement)}</Text>
                        <TouchableOpacity onPress={() => deleteElement(selectedElement)} accessibilityRole="button" style={styles.selectionDel}>
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.selectionMeta}>
                        {selectedElement.x}, {selectedElement.y} · {selectedElement.width}×{selectedElement.height}
                        {selectedElement.shelves.length > 0 ? ` · ${selectedElement.shelves.length} shelf${selectedElement.shelves.length === 1 ? '' : 's'}` : ''}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.hint}>Select an element to edit, place items, or view its contents.</Text>
                  )}
                </>
              )}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* New model modal */}
      <Modal visible={showNewModel} transparent animationType="slide" onRequestClose={() => setShowNewModel(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Layout</Text>
              <TouchableOpacity onPress={() => setShowNewModel(false)} accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={newModelName}
              onChangeText={setNewModelName}
              placeholder="e.g. Main Kitchen"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <TouchableOpacity style={[styles.modalAddBtn, styles.fullBtn]} onPress={createModel} accessibilityRole="button">
              <Text style={styles.modalAddBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add element modal */}
      <Modal visible={showAddElement} transparent animationType="slide" onRequestClose={() => setShowAddElement(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Element</Text>
              <TouchableOpacity onPress={() => setShowAddElement(false)} accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.paletteGrid}>
              {ELEMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.paletteItem, { borderColor: ELEMENT_CONFIGS[type].color }]}
                  onPress={() => addElement(type)}
                  accessibilityRole="button"
                >
                  <Ionicons name={ELEMENT_CONFIGS[type].icon as any} size={22} color={ELEMENT_CONFIGS[type].color} />
                  <Text style={styles.paletteText}>{ELEMENT_CONFIGS[type].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit element modal */}
      {selectedElement ? (
        <ElementEditModal
          visible={showElementEdit}
          onClose={() => setShowElementEdit(false)}
          element={selectedElement}
          model={model}
          onSaved={loadElements}
          onDelete={() => {
            setShowElementEdit(false);
            deleteElement(selectedElement);
          }}
          client={client}
          token={session?.apiToken ?? ''}
        />
      ) : null}

      {/* Place items modal */}
      {selectedElement ? (
        <PlaceItemsModal
          visible={showPlaceItems}
          onClose={() => setShowPlaceItems(false)}
          pantry={pantry}
          equipment={equipment}
          onPlace={placeItem}
          placed={placedItemsFor(selectedElement).map((p) => p.name)}
        />
      ) : null}

      {/* Browse items modal */}
      {selectedElement ? (
        <BrowseItemsModal
          visible={showBrowse}
          onClose={() => setShowBrowse(false)}
          element={selectedElement}
          placedItems={placedItemsFor(selectedElement)}
          pantry={pantry}
          equipment={equipment}
          onUnplace={(p) => unplaceItem(selectedElement, p)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ElementEditModal({
  visible,
  onClose,
  element,
  model,
  onSaved,
  onDelete,
  client,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  element: KitchenElementWithPlacements;
  model: KitchenModel | null;
  onSaved: () => Promise<void>;
  onDelete: () => void;
  client: ApiClient | null;
  token: string;
}) {
  const [name, setName] = useState(element.custom_name ?? '');
  const [x, setX] = useState(String(element.x));
  const [y, setY] = useState(String(element.y));
  const [width, setWidth] = useState(String(element.width));
  const [height, setHeight] = useState(String(element.height));
  const [color, setColor] = useState(element.custom_color ?? '');
  const [shelves, setShelves] = useState<Shelf[]>(element.shelves ?? []);

  useEffect(() => {
    setName(element.custom_name ?? '');
    setX(String(element.x));
    setY(String(element.y));
    setWidth(String(element.width));
    setHeight(String(element.height));
    setColor(element.custom_color ?? '');
    setShelves(element.shelves ?? []);
  }, [element]);

  const save = async () => {
    if (!client) return;
    try {
      await updateKitchenElement(client, token, element.id, {
        x: Number(x) || 0,
        y: Number(y) || 0,
        width: Number(width) || 40,
        height: Number(height) || 40,
        custom_name: name.trim() || null,
        custom_color: color.trim() || null,
        shelves,
      });
      onClose();
      await onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not save.');
    }
  };

  const addShelf = () => {
    const n = shelves.length + 1;
    const each = Number((100 / n).toFixed(1));
    setShelves(shelves.map((s) => ({ ...s, height_percent: each })).concat({ name: `Shelf ${n}`, height_percent: each }));
  };

  const renameShelf = (index: number, value: string) => {
    setShelves(shelves.map((s, i) => (i === index ? { ...s, name: value } : s)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Element</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Element name" placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Color</Text>
          <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="#fbbf24" placeholderTextColor={colors.textMuted} autoCapitalize="none" />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>X</Text>
              <TextInput style={styles.input} value={x} onChangeText={setX} keyboardType="numeric" />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Y</Text>
              <TextInput style={styles.input} value={y} onChangeText={setY} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Width</Text>
              <TextInput style={styles.input} value={width} onChangeText={setWidth} keyboardType="numeric" />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Height</Text>
              <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" />
            </View>
          </View>
          {model ? <Text style={styles.hintSmall}>Canvas: {model.canvas_width}×{model.canvas_height}</Text> : null}

          <View style={styles.shelfRow}>
            <Text style={styles.shelfTitle}>Shelves</Text>
            <TouchableOpacity onPress={addShelf} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {shelves.length === 0 ? <Text style={styles.hintSmall}>No shelves. Items will be listed flat.</Text> : null}
          {shelves.map((s, i) => (
            <View key={i} style={styles.shelfItem}>
              <TextInput
                style={[styles.input, styles.flex1]}
                value={s.name}
                onChangeText={(v) => renameShelf(i, v)}
                placeholder={`Shelf ${i + 1}`}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setShelves(shelves.filter((_, idx) => idx !== i))}
                accessibilityRole="button"
                style={styles.shelfDel}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={[styles.modalAddBtn, styles.fullBtn]} onPress={save} accessibilityRole="button">
            <Text style={styles.modalAddBtnText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.deleteBtn, styles.fullBtn]} onPress={onDelete} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Remove Element</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlaceItemsModal({
  visible,
  onClose,
  pantry,
  equipment,
  onPlace,
  placed,
}: {
  visible: boolean;
  onClose: () => void;
  pantry: PantryItem[];
  equipment: Equipment[];
  onPlace: (itemType: 'ingredient' | 'equipment', itemId: string) => void;
  placed: string[];
}) {
  const [tab, setTab] = useState<'ingredient' | 'equipment'>('ingredient');
  const rows = tab === 'ingredient'
    ? pantry.map((i) => ({ id: i.id, name: i.ingredient_name }))
    : equipment.map((e) => ({ id: e.id, name: e.name }));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Place Item</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab === 'ingredient' && styles.tabActive]} onPress={() => setTab('ingredient')} accessibilityRole="button">
              <Text style={[styles.tabText, tab === 'ingredient' && styles.tabTextActive]}>Ingredients</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'equipment' && styles.tabActive]} onPress={() => setTab('equipment')} accessibilityRole="button">
              <Text style={[styles.tabText, tab === 'equipment' && styles.tabTextActive]}>Equipment</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isPlaced = placed.includes(item.name);
              return (
                <TouchableOpacity style={styles.placeRow} onPress={() => onPlace(tab, item.id)} disabled={isPlaced} accessibilityRole="button">
                  <Text style={[styles.placeRowText, isPlaced && styles.strike]}>{item.name}</Text>
                  {isPlaced ? <Ionicons name="checkmark" size={18} color={colors.textMuted} /> : <Ionicons name="add" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No {tab === 'ingredient' ? 'ingredients' : 'equipment'} yet.</Text>}
            style={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
}

function BrowseItemsModal({
  visible,
  onClose,
  element,
  placedItems,
  pantry,
  equipment,
  onUnplace,
}: {
  visible: boolean;
  onClose: () => void;
  element: KitchenElementWithPlacements;
  placedItems: PlacedItem[];
  pantry: PantryItem[];
  equipment: Equipment[];
  onUnplace: (placement: ElementItemPlacement) => void;
}) {
  const shelves = element.shelves ?? [];
  const placements = element.placements ?? [];

  const getPlacementFor = (name: string): ElementItemPlacement | undefined =>
    placements.find((p) => {
      if (p.item_type === 'ingredient') return pantry.find((x) => x.id === p.item_id)?.ingredient_name === name;
      return equipment.find((x) => x.id === p.item_id)?.name === name;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{elementLabel(element)}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {shelves.length === 0 ? (
            <FlatList
              data={placedItems}
              keyExtractor={(item, i) => `${item.name}-${i}`}
              renderItem={({ item }) => {
                const placement = getPlacementFor(item.name);
                return (
                  <View style={styles.placeRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.placeRowText}>{item.name}</Text>
                      {item.kind === 'ingredient' && item.amount !== undefined ? (
                        <Text style={styles.cardMeta}>{`${item.amount} ${item.unit ?? ''}`.trim()} · Pantry</Text>
                      ) : (
                        <Text style={styles.cardMeta}>Equipment</Text>
                      )}
                    </View>
                    {placement ? (
                      <TouchableOpacity onPress={() => onUnplace(placement)} accessibilityRole="button">
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No items placed here.</Text>}
              style={styles.list}
            />
          ) : (
            <ScrollView style={styles.list}>
              {shelves.map((shelf, i) => {
                const shelfItems = placedItems.filter((_, idx) => idx % shelves.length === i);
                return (
                  <View key={i} style={styles.shelfBlock}>
                    <Text style={styles.shelfBlockTitle}>{shelf.name}</Text>
                    {shelfItems.length === 0 ? (
                      <Text style={styles.cardMeta}>Empty</Text>
                    ) : (
                      shelfItems.map((item, idx) => {
                        const placement = getPlacementFor(item.name);
                        return (
                          <View key={idx} style={styles.placeRow}>
                            <Text style={styles.placeRowText}>{item.name}</Text>
                            {placement ? (
                              <TouchableOpacity onPress={() => onUnplace(placement)} accessibilityRole="button">
                                <Ionicons name="close-circle" size={20} color={colors.danger} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  newBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyBig: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  modelBar: { marginBottom: spacing.md },
  modelChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.card },
  modelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modelChipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  modelChipTextActive: { color: colors.white },
  loader: { marginTop: spacing.lg },
  canvasWrap: { alignItems: 'center', marginTop: spacing.xs },
  canvas: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, position: 'relative' },
  canvasEl: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, padding: 2 },
  canvasElText: { color: '#1f2937', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  canvasElCount: { position: 'absolute', top: 2, right: 2, backgroundColor: '#00000055', color: colors.white, fontSize: 9, fontWeight: '700', borderRadius: 8, paddingHorizontal: 4, overflow: 'hidden' },
  toolRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  toolPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  toolPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  toolText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  selectionCard: { marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  selectionDel: { padding: spacing.xs },
  selectionMeta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  hint: { marginTop: spacing.md, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  hintSmall: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  paletteItem: { width: '30%', alignItems: 'center', borderWidth: 2, borderRadius: radii.md, padding: spacing.sm, backgroundColor: colors.background, justifyContent: 'center' },
  paletteText: { fontSize: 11, fontWeight: '600', color: colors.text, marginTop: spacing.xs, textAlign: 'center' },
  fullBtn: { marginTop: spacing.sm },
  modalAddBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  modalAddBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, paddingVertical: spacing.md },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  shelfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  shelfTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  shelfItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  shelfDel: { padding: spacing.xs },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  list: { maxHeight: 360 },
  placeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  placeRowText: { fontSize: 15, color: colors.text, flex: 1 },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  shelfBlock: { marginBottom: spacing.md },
  shelfBlockTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
});
