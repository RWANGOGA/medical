import React from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, ScrollView, Dimensions, ActivityIndicator } from "react-native";
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";

const W = Dimensions.get("window").width - 64;
const H = 220;
const MAX = 60;
const L = 34, R = 12, T = 12, B = 30;
const IW = W - L - R, IH = H - T - B;
const y = (v: number) => T + IH - (v / MAX) * IH;

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
            <Rect x={bx} y={by} width={barW} height={T + IH - by} fill={BRANDING.colors.reserve} rx={4} />
            <SvgText x={bx + barW / 2} y={H - 8} fontSize={9} fill="#64748B" textAnchor="middle">{it.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function ResistanceScreen() {
  const { data: trends, isLoading: lt } = useQuery({ queryKey: ["trends"], queryFn: api.getDashboardTrends });
  const { data: organisms, isLoading: lo } = useQuery({ queryKey: ["organisms"], queryFn: api.getOrganisms });
  const { data: antibiogram, isLoading: la } = useQuery({ queryKey: ["antibiogram"], queryFn: api.getDashboardAntibiogram });

  const getSirColor = (val: string) => val === "S" ? BRANDING.colors.access : val === "I" ? BRANDING.colors.watch : val === "R" ? BRANDING.colors.reserve : "#94A3B8";

  const years = trends?.map((t: any) => t.year) || [];
  const series = [
    { name: "ESBL E. coli", color: BRANDING.colors.primary, data: trends?.map((t: any) => t.esbl_ecoli) || [] },
    { name: "MRSA", color: BRANDING.colors.watch, data: trends?.map((t: any) => t.mrsa) || [] },
    { name: "CRE", color: BRANDING.colors.reserve, data: trends?.map((t: any) => t.cre) || [] },
  ];
  const bars = (organisms || []).map((o: any) => ({ label: o.name.split(" ")[0] === "Escherichia" ? "E. coli" : o.name.split(" ")[0] === "Klebsiella" ? "K. pneumoniae" : o.name.split(" ")[0] === "Staphylococcus" ? "S. aureus" : "P. aeruginosa", value: o.resistance_rate }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Resistance Dashboard</Text>
        <Text style={styles.subtitle}>Live surveillance from your database</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>RESISTANCE TRENDS OVER TIME (%)</Text>
        {lt ? <ActivityIndicator /> : <LineChart years={years} series={series} />}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>MOST RESISTANT ORGANISMS — CURRENT QUARTER</Text>
        {lo ? <ActivityIndicator /> : <BarChart items={bars} />}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>HOSPITAL ANTIBIOGRAM HEAT MAP</Text>
        {la ? <ActivityIndicator /> : (
          <View>
            <View style={styles.heatRow}>
              <View style={styles.heatHeaderCell} />
              {antibiogram?.drugs.map((d: string) => <View key={d} style={styles.heatHeaderCell}><Text style={styles.heatHeaderText} numberOfLines={1}>{d}</Text></View>)}
            </View>
            {antibiogram?.organisms.map((org: string, ri: number) => (
              <View key={org} style={styles.heatRow}>
                <View style={styles.heatHeaderCell}><Text style={styles.orgName} numberOfLines={1}>{org}</Text></View>
                {antibiogram?.grid[ri].map((val: string, ci: number) => (
                  <View key={ci} style={[styles.heatCell, { backgroundColor: getSirColor(val) + "20" }]}>
                    <Text style={[styles.heatCellText, { color: getSirColor(val) }]}>{val}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { backgroundColor: BRANDING.colors.surface, padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  title: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { color: BRANDING.colors.subtext, marginTop: 4 },
  card: { backgroundColor: BRANDING.colors.surface, margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border },
  cardTitle: { fontSize: 12, fontWeight: "700", color: BRANDING.colors.subtext, letterSpacing: 0.5, marginBottom: 12 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: BRANDING.colors.subtext },
  heatRow: { flexDirection: "row", marginBottom: 8 },
  heatHeaderCell: { flex: 1, justifyContent: "center", alignItems: "center", padding: 4 },
  heatHeaderText: { fontSize: 10, fontWeight: "700", color: BRANDING.colors.subtext, textTransform: "uppercase" },
  orgName: { fontSize: 11, fontWeight: "700", fontStyle: "italic", color: BRANDING.colors.text },
  heatCell: { flex: 1, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 8, marginHorizontal: 2 },
  heatCellText: { fontSize: 14, fontWeight: "800" },
});