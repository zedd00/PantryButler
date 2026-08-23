import net from 'net';
import tls from 'tls';
import os from 'os';
import { getEffectiveSmtp, type EffectiveSmtpConfig } from './system-config';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

// Minimal SMTP transport built on node's net/tls (no external dependency).
// Supports implicit TLS (SMTPS), STARTTLS, and AUTH PLAIN. Failures throw a
// descriptive Error so callers can surface them.

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function dotStuff(body: string): string {
  return body.replace(/^\./gm, '..');
}

export function buildMessageBody(cfg: EffectiveSmtpConfig, message: EmailMessage): string {
  const from = sanitizeHeader(cfg.from);
  const to = sanitizeHeader(message.to);
  const subject = sanitizeHeader(message.subject);
  return [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(message.text),
  ].join('\r\n');
}

export function createSmtpMailer(cfg: EffectiveSmtpConfig): Mailer {
  return {
    async send(message) {
      await runSmtpConversation(cfg, message);
    },
  };
}

// Dev fallback: when no SMTP host is configured, print the message (including
// verification links) to the server log instead of sending it.
export function createLogMailer(): Mailer {
  return {
    async send(message) {
      console.log(`[mailer:dev] To: ${message.to}`);
      console.log(`[mailer:dev] Subject: ${message.subject}`);
      console.log(`[mailer:dev] ${message.text}`);
    },
  };
}

// Route a message to the effective transport (SMTP if configured, else the
// dev log fallback).
export async function sendEmail(message: EmailMessage): Promise<void> {
  const smtp = await getEffectiveSmtp();
  const mailer = smtp.host ? createSmtpMailer(smtp) : createLogMailer();
  await mailer.send(message);
}

function runSmtpConversation(cfg: EffectiveSmtpConfig, message: EmailMessage): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port })
      : net.createConnection({ host: cfg.host, port: cfg.port });

    let buffer = '';
    let pendingReply: { lines: string[]; resolve: (reply: string) => void; reject: (err: Error) => void } | null = null;
    let finished = false;

    const timeout = setTimeout(() => fail(new Error('SMTP connection timed out')), 20000);

    function fail(err: Error): void {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.destroy();
      reject(err);
    }

    function onData(chunk: Buffer): void {
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (pendingReply) {
          pendingReply.lines.push(line);
          if (/^\d{3} /.test(line)) {
            const p = pendingReply;
            pendingReply = null;
            p.resolve(p.lines.join('\n'));
          }
        }
      }
    }

    socket.on('error', fail);
    socket.on('data', onData);

    const command = (data: string): Promise<string> =>
      new Promise((res, rej) => {
        if (pendingReply) {
          rej(new Error('SMTP command overlap'));
          return;
        }
        pendingReply = { lines: [], resolve: res, reject: rej };
        socket.write(data + '\r\n', (err) => {
          if (err) {
            pendingReply = null;
            rej(err);
          }
        });
      });

    const nextReply = (): Promise<string> =>
      new Promise((res, rej) => {
        pendingReply = { lines: [], resolve: res, reject: rej };
      });

    const writeRaw = (data: string): Promise<void> =>
      new Promise((res, rej) => {
        socket.write(data, (err) => (err ? rej(err) : res()));
      });

    const assert = (reply: string, codes: string[], step: string): void => {
      const code = reply.slice(0, 3);
      if (!codes.includes(code)) {
        throw new Error(`SMTP ${step} failed: ${reply.split('\n')[0]}`);
      }
    };

    (async () => {
      try {
        const greeting = await nextReply();
        assert(greeting, ['220'], 'greeting');

        const ehloName = os.hostname() || 'localhost';
        let reply = await command(`EHLO ${ehloName}`);
        assert(reply, ['250'], 'EHLO');

        if (!cfg.secure && /STARTTLS/i.test(reply)) {
          reply = await command('STARTTLS');
          assert(reply, ['220'], 'STARTTLS');
          const tlsSocket = tls.connect({ socket, rejectUnauthorized: false });
          tlsSocket.on('error', fail);
          tlsSocket.on('data', onData);
          const tlsGreeting = await new Promise<string>((res, rej) => {
            tlsSocket.once('secureConnect', () => {
              pendingReply = { lines: [], resolve: res, reject: rej };
            });
            tlsSocket.once('error', rej);
          });
          assert(tlsGreeting, ['220'], 'TLS greeting');
          socket = tlsSocket;
          reply = await command(`EHLO ${ehloName}`);
          assert(reply, ['250'], 'EHLO (TLS)');
        }

        if (cfg.username && cfg.password !== null) {
          const auth = Buffer.from(`\0${cfg.username}\0${cfg.password}`).toString('base64');
          reply = await command(`AUTH PLAIN ${auth}`);
          assert(reply, ['235'], 'AUTH');
        }

        reply = await command(`MAIL FROM:<${sanitizeHeader(cfg.from)}>`);
        assert(reply, ['250'], 'MAIL FROM');

        reply = await command(`RCPT TO:<${sanitizeHeader(message.to)}>`);
        assert(reply, ['250'], 'RCPT TO');

        reply = await command('DATA');
        assert(reply, ['354'], 'DATA');

        await writeRaw(buildMessageBody(cfg, message) + '\r\n.\r\n');
        const dataReply = await nextReply();
        assert(dataReply, ['250'], 'DATA delivery');

        await command('QUIT');
        clearTimeout(timeout);
        socket.end();
        finished = true;
        resolve();
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}