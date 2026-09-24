<?php

return [
    // Expired holds are reclaimed on the next checkout for the same voucher.
    'voucher_reservation_minutes' => 1440,

    // Universal pending-order TTL in minutes. All pending orders (with or without vouchers)
    // are reclaimed after this period to prevent permanent stock locks.
    'pending_order_ttl_minutes' => 30,
];
