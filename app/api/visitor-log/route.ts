import { NextResponse } from 'next/server';
import { VisitorLog } from '@/lib/visitorLogging';
import { queueVisitorLog } from '@/lib/visitorLoggingBatch';
import { isLoggingEnabled } from '@/lib/loggingState';

export async function POST(request: Request) {
  // Check if logging is enabled globally
  const loggingEnabled = isLoggingEnabled();
  
  if (!loggingEnabled) {
    return NextResponse.json({ message: 'Logging is disabled' }, { status: 200 });
  }

  try {
    // Be defensive: some clients (sendBeacon) may send no body or invalid JSON. Accept empty body gracefully.
    let body: any = {};
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch (parseErr) {
          console.warn('[Visitor Log API] Failed to parse JSON body, treating as empty payload:', parseErr);
          body = {};
        }
      } else {
        // Empty body — treat as a minimal request where visitId/action may be set via headers or be absent
        body = {};
      }
    } catch (readErr) {
      console.warn('[Visitor Log API] Error reading request body, treating as empty payload:', readErr);
      body = {};
    }

    const {
      userAgent,
      referer,
      url,
      pageLoadTime,
      userId,
      visitId,
      action,
      startTime,
      endTime,
      durationSeconds,
    } = body || {};

    // Get IP address
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // If this is an 'end' event, finalize the visit immediately (not queued)
    if (action === 'end' && visitId) {
      try {
        const endTs = endTime ? new Date(endTime) : new Date();
        await (await import('@/lib/visitorLogging')).finalizeVisit(visitId, endTs, durationSeconds);
        return NextResponse.json({ message: 'Visit finalized' }, { status: 200 });
      } catch (err) {
        console.error('[Visitor Log API] Error finalizing visit:', err);
        return NextResponse.json({ message: 'Processed' }, { status: 200 });
      }
    }

    // Simple browser detection from user agent
    const getBrowserInfo = (ua: string) => {
      let browserName = 'Unknown';
      let browserVersion = 'Unknown';

      if (ua.includes('Chrome')) {
        browserName = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Safari')) {
        browserName = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Firefox')) {
        browserName = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Edge')) {
        browserName = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        if (match) browserVersion = match[1];
      }

      return { browserName, browserVersion };
    };

    // Simple OS detection from user agent
    const getOSInfo = (ua: string) => {
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Macintosh')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      return 'Unknown';
    };

    const { browserName, browserVersion } = getBrowserInfo(userAgent || '');
    const operatingSystem = getOSInfo(userAgent || '');

    const visitorLog: VisitorLog = {
      ipAddress,
      userAgent: userAgent || '',
      browser: browserName,
      browserVersion: browserVersion,
      operatingSystem: operatingSystem,
      timestamp: startTime ? new Date(startTime) : new Date(),
      url: url || '/',
      referer: referer || undefined,
      pageLoadTime: pageLoadTime || undefined,
      userId: userId || undefined,
      visitId: visitId || undefined,
      startTime: startTime ? new Date(startTime) : undefined,
    };

    // Queue visitor log for batch writing (async, non-blocking)
    queueVisitorLog(visitorLog).catch((error) => {
      // Don't throw - let the response go through even if logging fails
      console.error('[Visitor Log API] Error queuing log:', error);
    });

    return NextResponse.json(
      { message: 'Visitor logged successfully' },
      { status: 200 }
    );
  } catch (err: unknown) {
    // Log the error but return success to not block the user experience
    console.error('[Visitor Log API] Error processing request:', err);
    return NextResponse.json(
      { message: 'Request processed' },
      { status: 200 }
    );
  }
}
