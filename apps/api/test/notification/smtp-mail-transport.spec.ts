import { SmtpMailTransport } from '../../src/modules/notification/smtp-mail-transport';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }) }));

const transport = () => new SmtpMailTransport({ host: 'smtp.test', port: 25, from: 'no-reply@mrr.local' });
const message = { to: ['e2e.u1@mrr.local', 'e2e.u2@mrr.local', 'e2e.u3@mrr.local'], subject: 'ใกล้ถึงเวลาประชุม', text: 'x' };

// BR-mrr-020@v2 · EX-mrr-112 · AC-mrr-115: a recipient the server refuses makes the whole send fail.
describe('SmtpMailTransport.send', () => {
  beforeEach(() => sendMail.mockReset());

  it('resolves when every recipient is accepted (AC-mrr-115)', async () => {
    sendMail.mockResolvedValue({ accepted: message.to, rejected: [] });
    await expect(transport().send(message)).resolves.toBeUndefined();
  });

  it('rejects when one of several recipients is refused (AC-mrr-115)', async () => {
    sendMail.mockResolvedValue({ accepted: message.to.slice(0, 2), rejected: ['e2e.u3@mrr.local'] });
    await expect(transport().send(message)).rejects.toThrow(/e2e\.u3@mrr\.local/);
  });

  it('rejects when every recipient is refused, as before', async () => {
    sendMail.mockRejectedValue(new Error('all recipients were rejected'));
    await expect(transport().send(message)).rejects.toThrow('all recipients were rejected');
  });

  it('accepts a refused recipient given as an address object', async () => {
    sendMail.mockResolvedValue({ rejected: [{ address: 'e2e.u3@mrr.local', name: '' }] });
    await expect(transport().send(message)).rejects.toThrow(/e2e\.u3@mrr\.local/);
  });
});
