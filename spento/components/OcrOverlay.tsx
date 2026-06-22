import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, type Category, type Expense, generateId } from '@/lib/data';
import { API_URL } from '@/lib/api-config';

const PRIMARY = '#9644D8';
const VALID_CATS: Category[] = ['Useful', 'Sweets', 'Needs', 'Harmful'];

type Phase = 'uploading' | 'processing' | 'streaming' | 'done' | 'error';

interface ParsedItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: Category;
  slide: Animated.Value;
  fade: Animated.Value;
  skeleton: Animated.Value;
}

export interface OcrOverlayProps {
  visible: boolean;
  /** Local file URI from expo-image-picker (file://...) */
  imageUri: string | null;
  userId?: string;
  isDarkTheme: boolean;
  onConfirm: (items: Omit<Expense, 'id'>[], receiptId?: string) => void;
  onCancel: () => void;
}

const CYCLE_MSGS = [
  'Загружаем изображение...',
  'Распознаём текст...',
  'Анализируем строки...',
  'Ищем позиции...',
];

// ─── Item card ───────────────────────────────────────────────────────────────

interface OcrItemCardProps {
  item: ParsedItem;
  cardBg: string;
  textClr: string;
  subClr: string;
  skelClr: string;
  currency: string;
}

const OcrItemCard: React.FC<OcrItemCardProps> = React.memo(({ item, cardBg, textClr, subClr, skelClr, currency }) => {
  const cat = CATEGORIES[item.category];
  const total = (item.price * item.quantity).toFixed(2);

  return (
    <Animated.View
      style={[
        oS.card,
        { backgroundColor: cardBg, opacity: item.fade, transform: [{ translateY: item.slide }] },
      ]}
    >
      <View style={[oS.catDot, { backgroundColor: cat.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[oS.itemName, { color: textClr }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[oS.itemCat, { color: cat.color }]}>{cat.label}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[oS.itemPrice, { color: textClr }]}>{total} {currency}</Text>
        {item.quantity > 1 && (
          <Text style={[oS.itemQty, { color: subClr }]}>×{item.quantity}</Text>
        )}
      </View>
      {/* Skeleton overlay fades out to reveal content */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, oS.skeleton, { backgroundColor: skelClr, opacity: item.skeleton }]}
        pointerEvents="none"
      />
    </Animated.View>
  );
});
OcrItemCard.displayName = 'OcrItemCard';

// ─── Main overlay ─────────────────────────────────────────────────────────────

export const OcrOverlay: React.FC<OcrOverlayProps> = ({
  visible, imageUri, userId, isDarkTheme, onConfirm, onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('uploading');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [statusMsg, setStatusMsg] = useState(CYCLE_MSGS[0]);
  const [errorMsg, setErrorMsg] = useState('');
  const cancelledRef = useRef(false);
  const msgOpacity = useRef(new Animated.Value(1)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const animMsg = useCallback((msg: string) => {
    Animated.timing(msgOpacity, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setStatusMsg(msg);
      Animated.timing(msgOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [msgOpacity]);

  // Sheet slide-in / slide-out
  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, {
        toValue: 1, useNativeDriver: true, tension: 65, friction: 13,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetAnim]);

  // Cycle status messages while waiting for the API
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'processing') return;
    let idx = 0;
    const id = setInterval(() => {
      idx = (idx + 1) % CYCLE_MSGS.length;
      animMsg(CYCLE_MSGS[idx]);
    }, 1600);
    return () => clearInterval(id);
  }, [phase, animMsg]);

  // Run OCR when overlay opens with a new image
  useEffect(() => {
    if (!visible || !imageUri) return;

    cancelledRef.current = false;
    setPhase('uploading');
    setItems([]);
    setErrorMsg('');
    setStatusMsg(CYCLE_MSGS[0]);

    const run = async () => {
      try {
        setPhase('processing');

        // Build multipart FormData — React Native handles local file:// URIs natively
        const form = new FormData();
        form.append('image', {
          uri:  imageUri,
          type: 'image/jpeg',
          name: 'receipt.jpg',
        } as unknown as Blob);
        if (userId) form.append('userId', userId);

        const resp = await fetch(`${API_URL}/api/ocr`, {
          method: 'POST',
          body: form,
          // Do NOT set Content-Type — RN sets it with the correct boundary
        });

        if (cancelledRef.current) return;

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          throw new Error(`Ошибка ${resp.status}${errBody ? ': ' + errBody : ''}`);
        }
        const data = await resp.json();

        if (cancelledRef.current) return;

        if (!data.items?.length) {
          animMsg('Позиции не найдены');
          setPhase('done');
          return;
        }

        receiptIdRef.current = data.receiptId;
        setPhase('streaming');
        animMsg(`Найдено ${data.items.length} позиций`);

        for (let i = 0; i < data.items.length; i++) {
          if (cancelledRef.current) return;

          const raw = data.items[i];
          const cat: Category = VALID_CATS.includes(raw.category) ? raw.category : 'Needs';

          const slide    = new Animated.Value(24);
          const fade     = new Animated.Value(0);
          const skeleton = new Animated.Value(1);

          const parsed: ParsedItem = {
            id: `ocr_${i}_${Date.now()}`,
            name: raw.name,
            price: raw.price,
            quantity: raw.quantity,
            category: cat,
            slide, fade, skeleton,
          };

          setItems(prev => [...prev, parsed]);
          // Scroll to bottom so new item is visible
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

          // Entrance animation
          Animated.parallel([
            Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 130, friction: 11 }),
            Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
          ]).start();

          // Skeleton fade-out after card is visible
          await new Promise<void>(resolve => setTimeout(() => {
            Animated.timing(skeleton, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => resolve());
          }, 300));

          if (i < data.items.length - 1) {
            await new Promise(r => setTimeout(r, 180));
          }
        }

        if (!cancelledRef.current) {
          animMsg(`Готово — добавлено ${data.items.length} позиций`);
          setPhase('done');
        }
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMsg(msg);
          animMsg('Не удалось распознать чек');
          setPhase('error');
        }
      }
    };

    run();

    return () => { cancelledRef.current = true; };
  }, [visible, imageUri, animMsg]);

  const receiptIdRef = useRef<string | undefined>(undefined);

  const handleConfirm = () => {
    const expenses: Omit<Expense, 'id'>[] = items.map(it => ({
      productId: `p_${it.name.toLowerCase().replace(/\s+/g, '_')}_${generateId()}`,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      category: it.category,
      date: new Date().toISOString(),
    }));
    onConfirm(expenses, receiptIdRef.current);
  };

  const cardBg  = isDarkTheme ? '#2C2C2E' : '#FFF';
  const sheetBg = isDarkTheme ? '#1C1C1E' : '#F2F2F7';
  const textClr = isDarkTheme ? '#FFF'    : '#1C1C1E';
  const subClr  = isDarkTheme ? '#8E8E93' : '#6C6C70';
  const skelClr = isDarkTheme ? '#3A3A3C' : '#E5E5EA';

  const translateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const isLoading = phase === 'uploading' || phase === 'processing';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <BlurView
        intensity={55}
        tint={isDarkTheme ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Tap outside to cancel while still loading */}
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={isLoading ? undefined : onCancel}
      />
      <Animated.View
        style={[oS.sheet, { backgroundColor: sheetBg, transform: [{ translateY }], paddingBottom: insets.bottom + 8 }]}
      >
        {/* Handle */}
        <View style={oS.handle} />

        {/* Header */}
        <View style={[oS.header, { borderBottomColor: isDarkTheme ? '#3A3A3C' : '#E0E0E0' }]}>
          <TouchableOpacity
            onPress={onCancel}
            style={oS.closeBtn}
            disabled={isLoading}
          >
            <Ionicons name="close" size={20} color={isLoading ? skelClr : subClr} />
          </TouchableOpacity>

          <View style={oS.statusRow}>
            {isLoading && (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
            )}
            {phase === 'done' && (
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" style={{ marginRight: 6 }} />
            )}
            {phase === 'error' && (
              <Ionicons name="alert-circle" size={18} color="#FF3B30" style={{ marginRight: 6 }} />
            )}
            <Animated.Text style={[oS.statusText, { color: textClr, opacity: msgOpacity }]}>
              {statusMsg}
            </Animated.Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* Items list */}
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {items.map(item => (
            <OcrItemCard
              key={item.id}
              item={item}
              cardBg={cardBg}
              textClr={textClr}
              subClr={subClr}
              skelClr={skelClr}
              currency="zł"
            />
          ))}

          {/* Empty state while scanning */}
          {items.length === 0 && (
            <View style={oS.scanPlaceholder}>
              <Animated.View style={{ opacity: isLoading ? undefined : 0.3 }}>
                <Ionicons name="scan-outline" size={52} color={PRIMARY} />
              </Animated.View>
              <Text style={[oS.scanText, { color: subClr }]}>
                {isLoading ? 'Сканирование чека...' : 'Позиции не найдены'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {phase === 'done' && items.length > 0 && (
          <View style={[oS.footer, { borderTopColor: isDarkTheme ? '#3A3A3C' : '#E0E0E0' }]}>
            <View>
              <Text style={[oS.footerLabel, { color: subClr }]}>Итого по чеку</Text>
              <Text style={[oS.footerTotal, { color: textClr }]}>{total.toFixed(2)} zł</Text>
            </View>
            <TouchableOpacity style={oS.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={oS.confirmText}>Добавить {items.length}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && items.length === 0 && (
          <View style={[oS.footer, { borderTopColor: isDarkTheme ? '#3A3A3C' : '#E0E0E0' }]}>
            <TouchableOpacity
              style={[oS.confirmBtn, { backgroundColor: '#636366', flex: 1 }]}
              onPress={onCancel}
            >
              <Text style={oS.confirmText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'error' && (
          <View style={[oS.footer, { borderTopColor: isDarkTheme ? '#3A3A3C' : '#E0E0E0' }]}>
            <Text style={[oS.errorText, { color: '#FF3B30', flex: 1 }]} numberOfLines={2}>{errorMsg}</Text>
            <TouchableOpacity
              style={[oS.confirmBtn, { backgroundColor: '#636366' }]}
              onPress={onCancel}
            >
              <Text style={oS.confirmText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const oS = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
  },
  statusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 15, fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  catDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  itemName: {
    fontSize: 14, fontWeight: '600',
  },
  itemCat: {
    fontSize: 12, marginTop: 1,
  },
  itemPrice: {
    fontSize: 15, fontWeight: '700',
  },
  itemQty: {
    fontSize: 12, marginTop: 1,
  },
  skeleton: {
    borderRadius: 12,
  },
  scanPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  scanText: {
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLabel: {
    fontSize: 12,
  },
  footerTotal: {
    fontSize: 18, fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  confirmText: {
    color: '#FFF', fontSize: 15, fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
  },
});
