import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, StatusError } from '../api';

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API wrapper', () => {
  it('normalizes cart lines and derives display metadata from server unit prices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [
        {
          id: 10,
          qty: '2',
          unit_price: '15000',
          stock: '4',
          product: { id: 1, name: 'Mouse', slug: 'mouse', price: 99_999, discount_price: 0, stock: 4, status: 'published', is_digital: false },
          variant: null,
        },
        {
          id: 11,
          qty: 1,
          unit_price: 20_000,
          stock: 8,
          product: { id: 2, name: 'E-book', slug: 'ebook', price: 20_000, discount_price: 0, stock: 8, status: 'published', is_digital: true },
          variant: { id: 7, label: 'PDF', price: '20000', stock: '8' },
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const cart = await api.cart();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/shop/cart', expect.objectContaining({ credentials: 'include' }));
    expect(cart).toMatchObject({ subtotal: 50_000, count: 3, hasPhysical: true, hasDigital: true });
    expect(cart.items[0]).toMatchObject({ price: 15_000, maxQty: 4, item: { id: '10', qty: 2 }, product: { id: '1', isDigital: false } });
    expect(cart.items[1].variant).toMatchObject({ id: '7', price: 20_000, stock: 8 });
  });

  it('surfaces joined validation messages for 422 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      message: 'Validation failed',
      errors: { code: ['Kode wajib diisi.'], subtotal: ['Subtotal tidak valid.'] },
    }, 422)));

    await expect(api.publicSettings()).rejects.toMatchObject<Partial<StatusError>>({
      status: 422,
      message: 'Kode wajib diisi. Subtotal tidak valid.',
    });
  });

  it('replaces server error details with a safe 5xx message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Database connection failed' }, 500)));

    await expect(api.publicSettings()).rejects.toMatchObject<Partial<StatusError>>({
      status: 500,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    });
  });

  it('maps mutation method, payload, credentials, and CSRF header', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ order: { id: 'order-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf%20token' });

    await api.createShopOrder({ voucher_code: 'HEMAT' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/sanctum/csrf-cookie', { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/orders/shop', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ voucher_code: 'HEMAT' }),
      credentials: 'include',
      headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf token', 'Content-Type': 'application/json' }),
    }));
  });

  it('URL-encodes identifiers in generated download URLs', () => {
    expect(api.digitalDownloadUrl('delivery/a b')).toBe('/api/v1/shop/digital-deliveries/delivery%2Fa%20b/download');
  });
});
