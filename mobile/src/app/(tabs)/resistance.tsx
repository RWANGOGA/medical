import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, ScrollView, useWindowDimensions, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";
import { CONTENT_MAX_WIDTH } from "../../components/screen";

const H = 220;
const MAX = 60;
const L = 34, R = 12, T = 12, B = 30;
const ALL = "All Hospitals";

const WHO: Record<string, string> = {
  "E. coli": "CRITICAL",
  "K. pneumoniae": "CRITICAL",
  "P. aeruginosa": "CRITICAL",
  "S. aureus": "HIGH",
};

function LineChart({ years, series, W, colors }: any) {
  const IW = W - L - R, IH = H - T - B;
  const y = (v: number) => T + IH - (v / MAX) * IH;
  const x = (i: number) => L + (i / Math.max(years.length - 1, 1)) * IW;
  return (
    <View>
      <Svg width={W} height={H}>
        {[0, 15, 30, 45, 60].map((t) => (
          <React.Fragment key={t}>
            <Line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            <SvgText x={L - 6} y={y(t) + 4} fontSize={10} fill={colors.subtext} textAnchor="end">{t}</SvgText>
          </React.Fragment>
        ))}
        {years.map((yr: string, i: number) => (
          <SvgText key={yr} x={x(i)} y={H - 8} fontSize={10} fill={colors.subtext} textAnchor="middle">{yr}</SvgText>
        ))}
        {series.map((s: any) => (
          <React.Fragment key={s.name}>
            <Path d={s.data.map((v: number, i: number) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} />
            {s.data.map((v: number, i: number) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} />)}
          </React.Fragment>
        ))}
      </Svg>
      <View style={stylesStatic.legendRow}>
        {series.map((s: any) => (
          <View key={s.name} style={stylesStatic.legendItem}>
            <View style={[stylesStatic.legendDot, { backgroundColor: s.color }]} />
            <Text style={{ fontSize: 11, color: colors.subtext }}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TrendDeltas({ trends, colors, styles }: any) {
  if (!trends || trends.length < 2) return null;
  const last = trends[trends.length - 1];
  const prev = trends[trends.length - 2];
  const rows = [
    { name: "ESBL E. coli", color: colors.primary, v: last.esbl_ecoli, d: last.esbl_ecoli - prev.esbl_ecoli },
    { name: "MRSA", color: colors.watch, v: last.mrsa, d: last.mrsa - prev.mrsa },
    { name: "CRE", color: colors.reserve, v: last.cre, d: last.cre - prev.cre },
  ];
  return (
    <View style={styles.deltaRow}>
      {rows.map((r) => (
        <View key={r.name} style={styles.deltaChip}>
          <Text style={[styles.deltaName, { color: r.color }]}>{r.name}</Text>
          <Text style={styles.deltaValue}>{r.v}%</Text>
          <Text style={{ color: r.d > 0 ? colors.reserve : r.d < 0 ? colors.access : colors.subtext, fontWeight: "800", fontSize: 10 }}>
            {r.d > 0 ? `+${r.d}` : r.d < 0 ? `${r.d}` : "0"} vs {prev.year}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BarChart({ items, W, colors }: any) {
  const IW = W - L - R, IH = H - T - B;
  const y = (v: number) => T + IH - (v / MAX) * IH;
  const whoColor = (p: string) => (p === "CRITICAL" ? colors.reserve : colors.watch);
  const gap = IW / items.length;
  const barW = gap * 0.6;
  return (
    <Svg width={W} height={H}>
      {[0, 15, 30, 45, 60].map((t) => (
        <React.Fragment key={t}>
          <Line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke={colors.border} strokeWidth={1} />
          <SvgText x={L - 6} y={y(t) + 4} fontSize={10} fill={colors.subtext} textAnchor="end">{t}</SvgText>
        </React.Fragment>
      ))}
      {items.map((it: any, i: number) => {
        const bx = L + i * gap + (gap - barW) / 2;
        const by = y(it.value);
        return (
          <React.Fragment key={it.label}>
            <Rect x={bx} y={by} width={barW} height={T + IH - by} fill={whoColor(WHO[it.label] || "HIGH")} rx={4} />
            <SvgText x={bx + barW / 2} y={H - 8} fontSize={9} fill={colors.subtext} textAnchor="middle">{it.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function EmpiricChecker({ stats, colors, styles }: any) {
  const [org, setOrg] = useState("E. coli");
  if (!stats) return null;
  const drugs = stats.drugs
    .map((d: string) => ({ drug: d, ...stats.cells[org][d] }))
    .filter((c: any) => c.n > 0)
    .sort((a: any, b: any) => b.pct_s - a.pct_s);
  const good = drugs.filter((c: any) => c.pct_s >= 90);
  const color = (p: number) => (p >= 90 ? colors.access : p >= 70 ? colors.watch : colors.reserve);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {stats.organisms.map((o: string) => (
            <TouchableOpacity key={o} style={[styles.chip, org === o && styles.chipActive]} onPress={() => setOrg(o)}>
              <Text style={[styles.chipText, org === o && styles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {drugs.map((c: any) => (
        <View key={c.drug} style={styles.empRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.empDrug}>{c.drug}</Text>
            <Text style={[styles.empPct, { color: color(c.pct_s) }]}>
              {c.pct_s}% S{c.n < 30 ? " (low n)" : ""}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${c.pct_s}%`, backgroundColor: color(c.pct_s) }]} />
          </View>
          <Text style={styles.empN}>n={c.n} isolates</Text>
        </View>
      ))}

      <View style={[styles.verdict, { backgroundColor: (good.length ? colors.access : colors.reserve) + "18" }]}>
        <Text style={{ fontSize: 12, color: colors.text, lineHeight: 18 }}>
          {good.length
            ? `Reliable empiric options for ${org}: ${good.map((g: any) => g.drug).join(", ")} (90% or more susceptible).`
            : `No agent reaches 90% susceptibility for ${org}. Obtain cultures before empiric escalation.`}
        </Text>
      </View>
    </View>
  );
}

export default function ResistanceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Chart width adapts to the screen but stays readable on wide displays
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const W = contentWidth - 64;

  const [hospital, setHospital] = useState(ALL);
  const active = hospital === ALL ? undefined : hospital;

  const { data: hospitals } = useQuery({ queryKey: ["hospitals"], queryFn: api.getHospitals });
  const { data: trends, isLoading: lt } = useQuery({ queryKey: ["trends", hospital], queryFn: () => api.getDashboardTrends(active) });
  const { data: organisms, isLoading: lo } = useQuery({ queryKey: ["organisms"], queryFn: api.getOrganisms });
  const { data: stats, isLoading: la } = useQuery({ queryKey: ["abx-stats", hospital], queryFn: () => api.getAntibiogramStats(active) });

  const whoColor = (p: string) => (p === "CRITICAL" ? colors.reserve : colors.watch);
  const getSirColor = (val: string) => (val === "S" ? colors.access : val === "I" ? colors.watch : val === "R" ? colors.reserve : colors.subtext);
  const letter = (c: any) => (c.n === 0 ? "-" : c.s >= c.i && c.s >= c.r ? "S" : c.i >= c.r ? "I" : "R");

  const years = trends?.map((t: any) => t.year) || [];
  const series = [
    { name: "ESBL E. coli", color: colors.primary, data: trends?.map((t: any) => t.esbl_ecoli) || [] },
    { name: "MRSA", color: colors.watch, data: trends?.map((t: any) => t.mrsa) || [] },
    { name: "CRE", color: colors.reserve, data: trends?.map((t: any) => t.cre) || [] },
  ];
  const bars = (organisms || []).map((o: any) => ({
    label: o.name.includes("coli") ? "E. coli" : o.name.includes("pneumo") ? "K. pneumoniae" : o.name.includes("aureus") ? "S. aureus" : "P. aeruginosa",
    value: o.resistance_rate,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>Resistance Dashboard</Text>
          <Text style={styles.subtitle}>Surveillance data from recorded laboratory results</Text>
        </View>
      </View>

      {/* Hospital filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {[ALL, ...(hospitals || [])].map((h) => (
          <TouchableOpacity key={h} style={[styles.chip, hospital === h && styles.chipActive]} onPress={() => setHospital(h)}>
            <Text style={[styles.chipText, hospital === h && styles.chipTextActive]}>{h}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.contentColumn}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resistance trends over time (%)</Text>
          {lt ? <ActivityIndicator color={colors.primary} /> : (
            <View>
              <LineChart years={years} series={series} W={W} colors={colors} />
              <TrendDeltas trends={trends} colors={colors} styles={styles} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Most resistant organisms — WHO priority</Text>
          {lo ? <ActivityIndicator color={colors.primary} /> : <BarChart items={bars} W={W} colors={colors} />}
          <View style={stylesStatic.legendRow}>
            {Object.keys(WHO).map((o) => (
              <View key={o} style={stylesStatic.legendItem}>
                <View style={[stylesStatic.legendDot, { backgroundColor: whoColor(WHO[o]) }]} />
                <Text style={{ fontSize: 11, color: colors.subtext }}>{o} · {WHO[o]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hospital antibiogram — %S with isolate counts</Text>
          {la ? <ActivityIndicator color={colors.primary} /> : (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.heatRow}>
                    <View style={styles.heatHeaderCell} />
                    {stats?.drugs.map((d: string) => (
                      <View key={d} style={styles.heatHeaderCell}><Text style={styles.heatHeaderText} numberOfLines={1}>{d}</Text></View>
                    ))}
                  </View>
                  {stats?.organisms.map((org: string) => (
                    <View key={org} style={styles.heatRow}>
                      <View style={styles.heatHeaderCell}><Text style={styles.orgName} numberOfLines={1}>{org}</Text></View>
                      {stats?.drugs.map((d: string) => {
                        const c = stats.cells[org][d];
                        const val = letter(c);
                        return (
                          <View key={d} style={[styles.heatCell, { backgroundColor: getSirColor(val) + "20" }]}>
                            <Text style={[styles.heatCellText, { color: getSirColor(val) }]}>{val}</Text>
                            <Text style={styles.heatN}>{c.n > 0 ? `n=${c.n}` : ""}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.footnote}>Fewer than 30 isolates: interpret with caution (CLSI M39). %S shown in the empiric checker below.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Empiric therapy checker (90% rule)</Text>
          {la ? <ActivityIndicator color={colors.primary} /> : <EmpiricChecker stats={stats} colors={colors} styles={styles} />}
        </View>
      </View>
    </ScrollView>
  );
}

// Layout-only styles shared with chart legends (no colors)
const stylesStatic = StyleSheet.create({
  legendRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { backgroundColor: c.surface, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    headerInner: { paddingHorizontal: 20, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    subtitle: { color: c.subtext, marginTop: 4, fontSize: 13 },
    chipRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: c.border, flexGrow: 0 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text },
    chipTextActive: { color: c.onPrimary, fontWeight: "700" },
    contentColumn: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    card: { backgroundColor: c.surface, margin: 16, marginBottom: 0, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontSize: 12, fontWeight: "700", color: c.subtext, letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" },
    deltaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 6 },
    deltaChip: { flex: 1, minWidth: 90, alignItems: "center", backgroundColor: c.background, borderRadius: 10, padding: 8, marginHorizontal: 3 },
    deltaName: { fontSize: 10, fontWeight: "700" },
    deltaValue: { fontSize: 16, fontWeight: "800", color: c.text, marginTop: 2 },
    heatRow: { flexDirection: "row", marginBottom: 8 },
    heatHeaderCell: { flex: 1, minWidth: 44, justifyContent: "center", alignItems: "center", padding: 4 },
    heatHeaderText: { fontSize: 10, fontWeight: "700", color: c.subtext, textTransform: "uppercase" },
    orgName: { fontSize: 11, fontWeight: "700", fontStyle: "italic", color: c.text },
    heatCell: { flex: 1, minWidth: 44, height: 42, justifyContent: "center", alignItems: "center", borderRadius: 8, marginHorizontal: 2 },
    heatCellText: { fontSize: 14, fontWeight: "800" },
    heatN: { fontSize: 8, color: c.subtext },
    footnote: { fontSize: 10, color: c.subtext, marginTop: 8 },
    empRow: { marginBottom: 12 },
    empDrug: { fontSize: 13, fontWeight: "700", color: c.text },
    empPct: { fontSize: 12, fontWeight: "800" },
    barTrack: { height: 8, backgroundColor: c.background, borderRadius: 4, marginTop: 4, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4 },
    empN: { fontSize: 9, color: c.subtext, marginTop: 2 },
    verdict: { borderRadius: 10, padding: 10, marginTop: 6 },
  });
}
