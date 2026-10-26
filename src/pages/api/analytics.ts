import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../config/database';
import { QueryTypes } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { startDate, endDate } = req.query;
    const dateFilter = startDate && endDate 
      ? `AND date BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    // Summary Stats
    const [summary] = await sequelize.query(`
      SELECT
        COUNT(*)::int as "totalSessions",
        SUM("chargeAmount") as "totalRevenue",
        AVG("chargeAmount") as "avgSessionValue",
        SUM("netContribution") as "totalProfit",
        SUM("electricityCost") as "totalCost"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    const profitMargin = summary.totalRevenue > 0 
      ? (parseFloat(summary.totalProfit) / parseFloat(summary.totalRevenue)) * 100 
      : 0;

    // Daily Trend
    const dailyTrend = await sequelize.query(`
      SELECT 
        date,
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue,
        SUM("netContribution") as profit,
        SUM("electricityCost") as cost
      FROM charging_sessions 
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY date 
      ORDER BY date
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Customer Segments
    const customerSegments = await sequelize.query(`
      SELECT 
        CASE 
          WHEN visit_count = 1 THEN 'New Customers'
          WHEN visit_count BETWEEN 2 AND 5 THEN 'Regular'
          WHEN visit_count BETWEEN 6 AND 10 THEN 'Frequent'
          ELSE 'VIP (10+)'
        END as segment_name,
        COUNT(*)::int as count
      FROM (
        SELECT "vehicleNo", COUNT(*) as visit_count
        FROM charging_sessions
        WHERE "tenantId" = :tenantId ${dateFilter}
        GROUP BY "vehicleNo"
      ) t
      GROUP BY segment_name
      ORDER BY 
        MIN(CASE 
          WHEN visit_count = 1 THEN 1
          WHEN visit_count BETWEEN 2 AND 5 THEN 2
          WHEN visit_count BETWEEN 6 AND 10 THEN 3
          ELSE 4
        END)
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    const formattedSegments = customerSegments.map((s: any) => ({
      name: s.segment_name,
      count: s.count
    }));

    // Hourly Distribution
    const hourlyDistribution = await sequelize.query(`
      SELECT 
        EXTRACT(HOUR FROM time::time)::int as hour,
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue
      FROM charging_sessions 
      WHERE "tenantId" = :tenantId AND time IS NOT NULL ${dateFilter.replace('AND', 'AND')}
      GROUP BY hour
      ORDER BY hour
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Payment Analysis
    const paymentAnalysis = await sequelize.query(`
      SELECT 
        "paymentMethod" as method,
        SUM(CASE WHEN "paymentStatus" = 'Paid' THEN "chargeAmount" ELSE 0 END) as paid,
        SUM(CASE WHEN "paymentStatus" = 'Pending' THEN "chargeAmount" ELSE 0 END) as pending,
        SUM(CASE WHEN "paymentStatus" = 'Partially Paid' THEN "chargeAmount" ELSE 0 END) as partial
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Charger Performance (for Radar Chart)
    const chargerStats = await sequelize.query(`
      SELECT 
        "chargerType",
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue,
        AVG("chargedPercent") as avg_charged,
        SUM("usedKwh") as total_kwh
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY "chargerType"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    const maxSessions = Math.max(...chargerStats.map((c: any) => c.sessions), 1);
    const maxRevenue = Math.max(...chargerStats.map((c: any) => parseFloat(c.revenue)), 1);
    const maxCharged = Math.max(...chargerStats.map((c: any) => parseFloat(c.avg_charged)), 1);
    const maxKwh = Math.max(...chargerStats.map((c: any) => parseFloat(c.total_kwh)), 1);

    const chargerPerformance = [
      { metric: 'Sessions', 
        GBT: chargerStats.find((c: any) => c.chargerType === 'GBT')?.sessions / maxSessions * 100 || 0,
        CCS2: chargerStats.find((c: any) => c.chargerType === 'CCS2')?.sessions / maxSessions * 100 || 0
      },
      { metric: 'Revenue', 
        GBT: chargerStats.find((c: any) => c.chargerType === 'GBT')?.revenue / maxRevenue * 100 || 0,
        CCS2: chargerStats.find((c: any) => c.chargerType === 'CCS2')?.revenue / maxRevenue * 100 || 0
      },
      { metric: 'Avg Charged%', 
        GBT: chargerStats.find((c: any) => c.chargerType === 'GBT')?.avg_charged / maxCharged * 100 || 0,
        CCS2: chargerStats.find((c: any) => c.chargerType === 'CCS2')?.avg_charged / maxCharged * 100 || 0
      },
      { metric: 'Total kWh', 
        GBT: chargerStats.find((c: any) => c.chargerType === 'GBT')?.total_kwh / maxKwh * 100 || 0,
        CCS2: chargerStats.find((c: any) => c.chargerType === 'CCS2')?.total_kwh / maxKwh * 100 || 0
      },
    ];

    // Rate Performance
    const ratePerformance = await sequelize.query(`
      SELECT 
        "ratePerPercent" as rate,
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY "ratePerPercent"
      ORDER BY "ratePerPercent"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Top Vehicles
    const topVehicles = await sequelize.query(`
      SELECT 
        "vehicleNo",
        COUNT(*)::int as visits,
        SUM("chargeAmount") as revenue
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY "vehicleNo"
      ORDER BY revenue DESC
      LIMIT 10
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Weekly Pattern
    const weeklyPattern = await sequelize.query(`
      SELECT 
        TO_CHAR(date, 'Day') as day_name,
        EXTRACT(DOW FROM date)::int as dow,
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue
      FROM charging_sessions
      WHERE "tenantId" = :tenantId ${dateFilter}
      GROUP BY day_name, dow
      ORDER BY dow
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sortedWeeklyPattern = weeklyPattern
      .map((w: any) => ({ ...w, day: w.day_name.trim() }))
      .sort((a: any, b: any) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    // Generate Insights
    const insights = [];
    
    // Peak hour insight
    const peakHour = hourlyDistribution.reduce((max: any, h: any) => 
      h.sessions > (max?.sessions || 0) ? h : max, null);
    if (peakHour) {
      insights.push({
        type: 'info',
        title: 'Peak Hour',
        description: `Most sessions occur at ${peakHour.hour}:00 with ${peakHour.sessions} sessions. Consider staffing accordingly.`
      });
    }

    // Profit margin insight
    if (profitMargin > 60) {
      insights.push({
        type: 'success',
        title: 'Healthy Profit Margin',
        description: `Your ${profitMargin.toFixed(1)}% profit margin is excellent. Operations are highly efficient.`
      });
    } else if (profitMargin < 40) {
      insights.push({
        type: 'warning',
        title: 'Low Profit Margin',
        description: `Profit margin of ${profitMargin.toFixed(1)}% is below target. Review pricing or reduce costs.`
      });
    }

    // Customer retention
    const repeatCustomers = formattedSegments.filter((s: any) => s.name !== 'New Customers')
      .reduce((sum: number, s: any) => sum + s.count, 0);
    const totalCustomers = formattedSegments.reduce((sum: number, s: any) => sum + s.count, 0);
    const retentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    
    if (retentionRate > 50) {
      insights.push({
        type: 'success',
        title: 'Strong Customer Retention',
        description: `${retentionRate.toFixed(0)}% of customers return. Your service quality is driving loyalty.`
      });
    } else {
      insights.push({
        type: 'warning',
        title: 'Focus on Retention',
        description: `Only ${retentionRate.toFixed(0)}% returning customers. Implement loyalty programs.`
      });
    }

    // Payment method preference
    const topPaymentMethod = paymentAnalysis.reduce((max: any, p: any) => {
      const total = parseFloat(p.paid) + parseFloat(p.pending) + parseFloat(p.partial);
      return total > (max.total || 0) ? { ...p, total } : max;
    }, {});
    if (topPaymentMethod.method) {
      insights.push({
        type: 'info',
        title: 'Preferred Payment',
        description: `${topPaymentMethod.method} is most popular. Ensure this method is always available.`
      });
    }

    // Charger utilization
    const mostUsedCharger = chargerStats.reduce((max: any, c: any) => 
      c.sessions > (max?.sessions || 0) ? c : max, null);
    if (mostUsedCharger) {
      insights.push({
        type: 'info',
        title: 'Charger Utilization',
        description: `${mostUsedCharger.chargerType} charger handles ${mostUsedCharger.sessions} sessions. Monitor maintenance needs.`
      });
    }

    // Revenue trend
    if (dailyTrend.length > 1) {
      const recentRevenue = dailyTrend.slice(-7).reduce((sum: number, d: any) => sum + parseFloat(d.revenue || 0), 0);
      const previousRevenue = dailyTrend.slice(-14, -7).reduce((sum: number, d: any) => sum + parseFloat(d.revenue || 0), 0);
      if (previousRevenue > 0) {
        if (recentRevenue > previousRevenue * 1.1) {
          insights.push({
            type: 'success',
            title: 'Revenue Growing',
            description: `Revenue up ${((recentRevenue / previousRevenue - 1) * 100).toFixed(0)}% vs previous week. Keep up the momentum!`
          });
        } else if (recentRevenue < previousRevenue * 0.9) {
          insights.push({
            type: 'warning',
            title: 'Revenue Declining',
            description: `Revenue down ${((1 - recentRevenue / previousRevenue) * 100).toFixed(0)}% vs previous week. Review pricing or promotions.`
          });
        }
      }
    }

    res.status(200).json({
      summary: {
        totalSessions: summary.totalSessions || 0,
        totalRevenue: parseFloat(summary.totalRevenue || 0).toFixed(2),
        avgSessionValue: parseFloat(summary.avgSessionValue || 0).toFixed(2),
        profitMargin: profitMargin.toFixed(2),
        sessionGrowth: 12.5, // Placeholder - calculate based on previous period
        revenueGrowth: 8.3,  // Placeholder - calculate based on previous period
      },
      dailyTrend,
      customerSegments: formattedSegments,
      hourlyDistribution,
      paymentAnalysis,
      chargerPerformance,
      ratePerformance,
      topVehicles,
      weeklyPattern: sortedWeeklyPattern,
      insights,
    });
  } catch (err: any) {
    console.error('Analytics API error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
