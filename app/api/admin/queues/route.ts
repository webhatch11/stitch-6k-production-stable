import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase-server";
import { Queue, Job } from "bullmq";
import { getSharedProducerConnection } from "@/lib/jobs/connection";

const queuesList = [
  "email-delivery",
  "shipment-retry",
  "payment-processing",
  "shipment-sync",
  "reservation-cleanup",
  "payment-recovery",
  "loyalty-expiry",
  "product-cleanup",
  "points-credit",
];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }
  
  const searchJobId = req.nextUrl.searchParams.get("searchJobId") || "";
  const searchOrderId = req.nextUrl.searchParams.get("searchOrderId") || "";
  
  const connection = getSharedProducerConnection();
  const result: any = {};
  
  try {
    for (const name of queuesList) {
      const q = new Queue(name, { connection: connection as any });
      const counts = await q.getJobCounts();
      const isPaused = await q.isPaused();
      
      let workersCount = 0;
      try {
        const workers = await q.getWorkers();
        workersCount = workers.length;
      } catch (e) {
        // Fallback if redis command fails
      }

      // 1. Fetch waiting, active, failed jobs
      const failedJobs = await q.getFailed(0, 50);
      const activeJobs = await q.getActive(0, 50);
      const waitingJobs = await q.getWaiting(0, 50);
      
      const formatJob = (job: any) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      });

      // 2. Oldest waiting job
      const waitingSorted = [...waitingJobs].sort((a, b) => a.timestamp - b.timestamp);
      const oldestWaitingJob = waitingSorted[0] ? formatJob(waitingSorted[0]) : null;

      // 3. Retry history (any jobs in active/failed/completed with attemptsMade > 1)
      const completedJobsForHistory = await q.getCompleted(0, 50);
      const allJobsPool = [...failedJobs, ...activeJobs, ...completedJobsForHistory];
      const retryHistoryJobs = allJobsPool
        .filter(j => j.attemptsMade > 1)
        .map(j => ({ id: j.id, attemptsMade: j.attemptsMade, status: j.failedReason ? "failed" : "succeeded" }));

      // 4. Filters & Search functionality
      let filteredFailed = failedJobs.map(formatJob);
      let filteredActive = activeJobs.map(formatJob);
      let filteredWaiting = waitingJobs.map(formatJob);

      if (searchJobId) {
        filteredFailed = filteredFailed.filter(j => String(j.id).includes(searchJobId));
        filteredActive = filteredActive.filter(j => String(j.id).includes(searchJobId));
        filteredWaiting = filteredWaiting.filter(j => String(j.id).includes(searchJobId));
      }

      if (searchOrderId) {
        const matchesOrder = (j: any) => {
          const d = j.data || {};
          return String(d.orderId || d.order_id || "").includes(searchOrderId);
        };
        filteredFailed = filteredFailed.filter(matchesOrder);
        filteredActive = filteredActive.filter(matchesOrder);
        filteredWaiting = filteredWaiting.filter(matchesOrder);
      }
      
      result[name] = {
        counts,
        isPaused,
        workersCount,
        oldestWaitingJob,
        retryHistory: retryHistoryJobs,
        jobs: {
          failed: filteredFailed,
          active: filteredActive,
          waiting: filteredWaiting,
        }
      };
      await q.close();
    }
    return NextResponse.json({ queues: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const body = await req.json();
  const { action, queueName, jobId } = body;
  
  if (!action || !queueName) {
    return NextResponse.json({ error: "Missing required params: action, queueName" }, { status: 400 });
  }
  
  if (!queuesList.includes(queueName)) {
    return NextResponse.json({ error: "Invalid queue name" }, { status: 400 });
  }
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }
  
  const connection = getSharedProducerConnection();
  
  try {
    const q = new Queue(queueName, { connection: connection as any });

    if (action === "pause") {
      await q.pause();
      await q.close();
      return NextResponse.json({ success: true, message: `Queue ${queueName} paused successfully` });
    } else if (action === "resume") {
      await q.resume();
      await q.close();
      return NextResponse.json({ success: true, message: `Queue ${queueName} resumed successfully` });
    }

    if (!jobId) {
      await q.close();
      return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 });
    }

    const job = await Job.fromId(q, jobId);
    if (!job) {
      await q.close();
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    
    if (action === "retry") {
      await job.retry();
      await q.close();
      return NextResponse.json({ success: true, message: `Job ${jobId} retried successfully` });
    } else if (action === "cancel") {
      await job.remove();
      await q.close();
      return NextResponse.json({ success: true, message: `Job ${jobId} removed successfully` });
    } else {
      await q.close();
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
