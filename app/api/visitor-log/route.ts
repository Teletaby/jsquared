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

    // Get IP address - try multiple header sources for better compatibility
    let ipAddress = 'unknown';
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      ipAddress = xForwardedFor.split(',')[0].trim();
    } else if (request.headers.get('x-real-ip')) {
      ipAddress = request.headers.get('x-real-ip') || 'unknown';
    } else if (request.headers.get('cf-connecting-ip')) {
      ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
    } else if (request.headers.get('x-client-ip')) {
      ipAddress = request.headers.get('x-client-ip') || 'unknown';
    }
    
    // Skip logging for loopback addresses (localhost)
    const loopbackAddresses = ['127.0.0.1', '::1', 'localhost', '0.0.0.0', '::'];
    if (loopbackAddresses.includes(ipAddress)) {
      console.log('[Visitor Log API] Skipping loopback address:', ipAddress);
      return NextResponse.json({ message: 'Loopback address skipped' }, { status: 200 });
    }
    
    // Log for debugging
    console.log('[Visitor Log API] IP Detection - Result:', ipAddress, 'Headers:', {
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-real-ip': request.headers.get('x-real-ip'),
      'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
      'x-client-ip': request.headers.get('x-client-ip'),
    });

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
      if (!ua) return { browserName: 'Unknown', browserVersion: 'Unknown' };
      
      let browserName = 'Unknown';
      let browserVersion = 'Unknown';

      if (ua.includes('Chrome') && !ua.includes('Chromium')) {
        browserName = 'Chrome';
        const match = ua.match(/Chrome\/([\d.]+)/);
        if (match) browserVersion = match[1].split('.')[0];
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browserName = 'Safari';
        const match = ua.match(/Version\/([\d.]+)/);
        if (match) browserVersion = match[1].split('.')[0];
      } else if (ua.includes('Firefox')) {
        browserName = 'Firefox';
        const match = ua.match(/Firefox\/([\d.]+)/);
        if (match) browserVersion = match[1].split('.')[0];
      } else if (ua.includes('Edg')) {
        browserName = 'Edge';
        const match = ua.match(/Edg[e|A|Dev]\/([\d.]+)/);
        if (match) browserVersion = match[1].split('.')[0];
      } else if (ua.includes('Opera') || ua.includes('OPR')) {
        browserName = 'Opera';
        const match = ua.match(/OPR\/([\d.]+)/);
        if (match) browserVersion = match[1].split('.')[0];
      }

      return { browserName, browserVersion };
    };

    // Simple OS detection from user agent
    const getOSInfo = (ua: string) => {
      if (!ua) return 'Unknown';
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Macintosh')) return 'macOS';
      if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      return 'Unknown';
    };

    const { browserName, browserVersion } = getBrowserInfo(userAgent || '');
    const operatingSystem = getOSInfo(userAgent || '');

    console.log('[Visitor Log API] Parsed info:', {
      userAgent: userAgent?.slice(0, 100),
      browser: browserName,
      browserVersion,
      os: operatingSystem,
      url,
      ipAddress,
    });

    const visitorLog: VisitorLog = {
      ipAddress,
      userAgent: userAgent || '',
      browser: browserName,
      browserVersion: browserVersion,
      operatingSystem: operatingSystem,
      timestamp: startTime ? new Date(startTime) : new Date(),
      url: url || 'unknown',
      referer: referer || undefined,
      pageLoadTime: pageLoadTime || undefined,
      userId: userId || undefined,
      visitId: visitId || undefined,
      startTime: startTime ? new Date(startTime) : undefined,
    };

    console.log('[Visitor Log API] Final visitor log object:', {
      ipAddress: visitorLog.ipAddress,
      browser: visitorLog.browser,
      os: visitorLog.operatingSystem,
      url: visitorLog.url,
      visitId: visitorLog.visitId,
    });

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
