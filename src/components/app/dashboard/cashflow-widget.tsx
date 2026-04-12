"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Filter, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompactINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

type CashflowAPIResponse = {
  chartData: Array<{ month: string; in: number; out: number; net: number }>;
  summary: { totalIn: number; totalOut: number; net: number };
};

export function CashflowWidget() {
  const [months, setMonths] = useState<string>("6");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [data, setData] = useState<CashflowAPIResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url = `/api/reports/cashflow?months=${months}`;
    if (filterType !== "ALL") {
      url += `&type=${filterType}`;
    }

    setLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load cashflow data", err);
        setLoading(false);
      });
  }, [months, filterType]);

  const yAxisFormatter = (value: number) => {
    return formatCompactINR(value);
  };

  return (
    <Card className="col-span-full overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Cash Flow Analysis
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare your monthly incoming receipts against your outflow (expenses, payments, wages).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filters:</span>
            </div>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-[130px] h-9 bg-background">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] h-9 bg-background">
                <SelectValue placeholder="Flow type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Flows</SelectItem>
                <SelectItem value="IN">Money In</SelectItem>
                <SelectItem value="OUT">Money Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid divide-y md:grid-cols-[1fr_minmax(250px,300px)] md:divide-x md:divide-y-0 divide-border/60">
          
          {/* Main Chart Section */}
          <div className="p-4 sm:p-6 min-h-[350px]">
             {loading ? (
               <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground animate-pulse">
                 Calculating financial aggregates...
               </div>
             ) : data?.chartData?.length === 0 ? (
               <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                 No cash activity recorded in this period.
               </div>
             ) : (
                <div className="h-[320px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.chartData ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={yAxisFormatter} 
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                        width={60}
                      />
                      <Tooltip 
                        cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                        contentStyle={{ 
                          borderRadius: "12px", 
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--background)/1)", 
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                        }}
                        formatter={(value: any) => formatINR(Number(value))}
                      />
                      <Legend 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: "13px", paddingTop: "20px" }} 
                      />
                      {(filterType === "ALL" || filterType === "IN") && (
                        <Bar 
                          name="Money In" 
                          dataKey="in" 
                          fill="hsl(var(--success, 142 71% 45%))" 
                          radius={[4, 4, 0, 0]} 
                        />
                      )}
                      {(filterType === "ALL" || filterType === "OUT") && (
                        <Bar 
                          name="Money Out" 
                          dataKey="out" 
                          fill="hsl(var(--danger, 0 84% 60%))" 
                          radius={[4, 4, 0, 0]} 
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             )}
          </div>

          {/* Sidebar Summary Section */}
          <div className="bg-muted/10 p-4 sm:p-6 flex flex-col justify-center">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Period Summary</h4>
            <div className="space-y-6">
              
              <div>
                <div className="flex items-center gap-2 text-sm text-success font-medium mb-1.5">
                  <ArrowUpRight className="h-4 w-4" /> Money In
                </div>
                <div className="text-3xl font-semibold tracking-tight">
                  {loading ? "---" : formatINR(data?.summary?.totalIn ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total receipts from clients</p>
              </div>

              <div>
                 <div className="flex items-center gap-2 text-sm text-danger font-medium mb-1.5">
                  <ArrowDownRight className="h-4 w-4" /> Money Out
                </div>
                <div className="text-3xl font-semibold tracking-tight">
                  {loading ? "---" : formatINR(data?.summary?.totalOut ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Vendor payouts, expenses & wages</p>
              </div>

              <div className="pt-6 border-t border-border/60">
                <div className="text-sm font-medium text-muted-foreground mb-1.5">Net Period Cash Flow</div>
                <div className={`text-2xl font-bold tracking-tight ${(data?.summary?.net ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                  {loading ? "---" : formatINR(data?.summary?.net ?? 0)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                   {((data?.summary?.net ?? 0) >= 0) ? (
                     <Badge variant="outline" className="bg-success/10 text-success border-success/20">Positive Flow</Badge>
                   ) : (
                     <Badge variant="outline" className="bg-danger/10 text-danger border-danger/20">Negative Flow</Badge>
                   )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
