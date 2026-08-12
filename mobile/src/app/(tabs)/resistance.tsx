import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";

const W = Dimensions.get("window").width - 64;
const H = 220;
const MAX = 60;
const L = 34, R = 12, T = 12, B = 30;
const IW = W - L - R, IH = H - T - B;
const y = (v: number) => T + IH - (v / MAX) * IH;
const ALL = "All Hospitals";

const WHO: Record<string, string> = {
  "E. coli": "CRITICAL",
  "K. pneumoniae": "CRITICAL",
  "P. aeruginosa": "CRITICAL",
  "S. aureus": "HIGH",
};
const whoColor = (p: string) => (p === "CRITICAL" ? BRANDING.colors.reserve : BRANDING.colors.watch);

function LineChart({ years, series }: any) {
  const x = (i: number) => L + (i / Math.max(years.length - 1, 1)) * IW;
  return (
    <View>
      <Svg width={W} height={H}>
        {[0, 15, 30, 45, 60].map((t) => (
          <React.Fragment key={t}>
            <Line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke="#E2E8F0" strokeWidth={1} />
            <SvgText x={L - 6} y={y(t) + 4} fontSize={10} fill="#64748B" textAnchor="end">{t}</SvgText>
          </React.Fragment>
        ))}
        {years.map((yr: string, i: number) => (
          <SvgText key={yr} x={x(i)} y={H - 8} fontSize={10} fill="#64748B" textAnchor="middle">{yr}</SvgText>
        ))}
        {series.map((s: any) => (
          <React.Fragment key={s.name}>
            <Path d={s.data.map((v: number, i: number) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} />
            {s.data.map((v: number, i: number) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} />)}
          </React.Fragment>
        ))}
      </Svg>
      <View style={styles.legendRow}>
        {series.map((s: any) => (
          <View key={s.name} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TrendDeltas({ trends }: any) {
  if (!trends || trends.length < 2) return null;
  const last = trends[trends.length - 1];
  const prev = trends[trends.length - 2];
  const rows = [
    { name: "ESBL E. coli", color: BRANDING.colors.primary, v: last.esbl_ecoli, d: last.esbl_ecoli - prev.esbl_ecoli },
    { name: "MRSA", color: BRANDING.colors.watch, v: last.mrsa, d: last.mrsa - prev.mrsa },
    { name: "CRE", color: BRANDING.colors.reserve, v: last.cre, d: last.cre - prev.cre },
  ];
  return (
    <View style={styles.deltaRow}>
      {rows.map((r) => (
        <View key={r.name} style={styles.deltaChip}>
          <Text style={[styles.deltaName, { color: r.color }]}>{r.name}</Text>
          <Text style={styles.deltaValue}>{r.v}%</Text>
          <Text style={{ color: r.d > 0 ? BRANDING.colors.reserve : r.d < 0 ? BRANDING.colors.access : BRANDING.colors.subtext, fontWeight: "800", fontSize: 10 }}>
            {r.d > 0 ? `▲ +${r.d}` : r.d < 0 ? `▼ ${r.d}` : "• 0"} vs {prev.year}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BarChart({ items }: any) {
  const gap = IW / items.length;
  const barW = gap * 0.6;
  return (
    <Svg width={W} height={H}>
      {[0, 15, 30, 45, 60].map((t) => (
        <React.Fragment key={t}>
          <Line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke="#E2E8F0" strokeWidth={1} />
          <SvgText x={L - 6} y={y(t) + 4} fontSize={10} fill="#64748B" textAnchor="end">{t}</SvgText>
        </React.Fragment>
      ))}
      {items.map((it: any, i: number) => {
        const bx = L + i * gap + (gap - barW) / 2;
        const by = y(it.value);
        return (
          <React.Fragment key={it.label}>
            <Rect x={bx} y={by} width={barW} height={T + IH - by} fill={whoColor(WHO[it.label] || "HIGH")} rx={4} />
            <SvgText x={bx + barW / 2} y={H - 8} fontSize={9} fill="#64748B" textAnchor="middle">{it.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function EmpiricChecker({ stats }: any) {
  const [org, setOrg] = useState("E. coli");
  if (!stats) return null;
  const drugs = stats.drugs
    .map((d: string) => ({ drug: d, ...stats.cells[org][d] }))
    .filter((c: any) => c.n > 0)
    .sort((a: any, b: any) => b.pct_s - a.pct_s);
  const good = drugs.filter((c: any) => c.pct_s >= 90);
  const color = (p: number) => (p >= 90 ? BRANDING.colors.access : p >= 70 ? BRANDING.colors.watch : BRANDING.colors.reserve);

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
              {c.pct_s}% S {c.n < 30 ? " ⚠" : ""}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${c.pct_s}%`, backgroundColor: color(c.pct_s) }]} />
          </View>
          <Text style={styles.empN}>n={c.n} isolates</Text>
        </View>
      ))}

      <View style={[styles.verdict, { backgroundColor: (good.length ? BRANDING.colors.access : BRANDING.colors.reserve) + "15" }]}>
        <Text style={{ fontSize: 12, color: BRANDING.colors.text, lineHeight: 18 }}>
          {good.length
            ? `✅ Reliable empiric options for ${org}: ${good.map((g: any) => g.drug).join(", ")} (≥90% susceptible).`
            : `⛔ No agent reaches ≥90% susceptibility for ${org}. Get cultures before empiric escalation.`}
        </Text>
      </View>
    </View>
  );
}

export default function ResistanceScreen() {
  const [hospital, setHospital] = useState(ALL);
  const active = hospital === ALL ? undefined : hospital;

  const { data: hospitals } = useQuery({ queryKey: ["hospitals"], queryFn: api.getHospitals });
  const { data: trends, isLoading: lt } = useQuery({ queryKey: ["trends", hospital], queryFn: () => api.getDashboardTrends(active) });
  const { data: organisms, isLoading: lo } = useQuery({ queryKey: ["organisms"], queryFn: api.getOrganisms });
  const { data: stats, isLoading: la } = useQuery({ queryKey: ["abx-stats", hospital], queryFn: () => api.getAntibiogramStats(active) });

  const getSirColor = (val: string) => (val === "S" ? BRANDING.colors.access : val === "I" ? BRANDING.colors.watch : val === "R" ? BRANDING.colors.reserve : "#94A3B8");
  const letter = (c: any) => (c.n === 0 ? "-" : c.s >= c.i && c.s >= c.r ? "S" : c.i >= c.r ? "I" : "R");

  const years = trends?.map((t: any) => t.year) || [];
  const series = [
    { name: "ESBL E. coli", color: BRANDING.colors.primary, data: trends?.map((t: any) => t.esbl_ecoli) || [] },
    { name: "MRSA", color: BRANDING.colors.watch, data: trends?.map((t: any) => t.mrsa) || [] },
    { name: "CRE", color: BRANDING.colors.reserve, data: trends?.map((t: any) => t.cre) || [] },
  ];
  const bars = (organisms || []).map((o: any) => ({
    label: o.name.includes("coli") ? "E. coli" : o.name.includes("pneumo") ? "K. pneumoniae" : o.name.includes("aureus") ? "S. aureus" : "P. aeruginosa",
    value: o.resistance_rate,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Resistance Dashboard</Text>
        <Text style={styles.subtitle}>Live surveillance from your database</Text>
      </View>

      {/* Hospital filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {[ALL, ...(hospitals || [])].map((h) => (
          <TouchableOpacity key={h} style={[styles.chip, hospital === h && styles.chipActive]} onPress={() => setHospital(h)}>
            <Text style={[styles.chipText, hospital === h && styles.chipTextActive]}>{h}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>RESISTANCE TRENDS OVER TIME (%)</Text>
        {lt ? <ActivityIndicator /> : (
          <View>
            <LineChart years={years} series={series} />
            <TrendDeltas trends={trends} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>MOST RESISTANT ORGANISMS — WHO PRIORITY</Text>
        {lo ? <ActivityIndicator /> : <BarChart items={bars} />}
        <View style={styles.legendRow}>
          {Object.keys(WHO).map((o) => (
            <View key={o} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: whoColor(WHO[o]) }]} />
              <Text style={styles.legendText}>{o} · {WHO[o]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>HOSPITAL ANTIBIOGRAM — %S WITH ISOLATE COUNTS</Text>
        {la ? <ActivityIndicator /> : (
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
                      <Text style={styles.heatN}>{c.n > 0 ? `n=${c.n}` : ""}{c.n > 0 && c.n < 30 ? " ⚠" : ""}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
            <Text style={styles.footnote}>⚠ Fewer than 30 isolates — interpret with caution (CLSI M39). %S shown in Empiric Checker below.</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>EMPIRIC THERAPY CHECKER (≥90% RULE)</Text>
        {la ? <ActivityIndicator /> : <EmpiricChecker stats={stats} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { backgroundColor: BRANDING.colors.surface, padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  title: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { color: BRANDING.colors.subtext, marginTop: 4 },
  chipRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border, flexGrow: 0 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  chipActive: { backgroundColor: BRANDING.colors.primary, borderColor: BRANDING.colors.primary },
  chipText: { fontSize: 12, color: BRANDING.colors.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: BRANDING.colors.surface, margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border },
  cardTitle: { fontSize: 12, fontWeight: "700", color: BRANDING.colors.subtext, letterSpacing: 0.5, marginBottom: 12 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: BRANDING.colors.subtext },
  deltaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  deltaChip: { flex: 1, alignItems: "center", backgroundColor: BRANDING.colors.background, borderRadius: 10, padding: 8, marginHorizontal: 3 },
  deltaName: { fontSize: 10, fontWeight: "700" },
  deltaValue: { fontSize: 16, fontWeight: "800", color: BRANDING.colors.text, marginTop: 2 },
  heatRow: { flexDirection: "row", marginBottom: 8 },
  heatHeaderCell: { flex: 1, justifyContent: "center", alignItems: "center", padding: 4 },
  heatHeaderText: { fontSize: 10, fontWeight: "700", color: BRANDING.colors.subtext, textTransform: "uppercase" },
  orgName: { fontSize: 11, fontWeight: "700", fontStyle: "italic", color: BRANDING.colors.text },
  heatCell: { flex: 1, height: 42, justifyContent: "center", alignItems: "center", borderRadius: 8, marginHorizontal: 2 },
  heatCellText: { fontSize: 14, fontWeight: "800" },
  heatN: { fontSize: 8, color: BRANDING.colors.subtext },
  footnote: { fontSize: 10, color: BRANDING.colors.subtext, marginTop: 8, fontStyle: "italic" },
  empRow: { marginBottom: 12 },
  empDrug: { fontSize: 13, fontWeight: "700", color: BRANDING.colors.text },
  empPct: { fontSize: 12, fontWeight: "800" },
  barTrack: { height: 8, backgroundColor: BRANDING.colors.background, borderRadius: 4, marginTop: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  empN: { fontSize: 9, color: BRANDING.colors.subtext, marginTop: 2 },
  verdict: { borderRadius: 10, padding: 10, marginTop: 6 },
});