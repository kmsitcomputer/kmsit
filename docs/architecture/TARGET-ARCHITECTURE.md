# TARGET ARCHITECTURE

```text
React 18 + TypeScript
        |
        v
REST API /api/v1 (same domain)
        |
        v
Laravel 13 Modular Monolith
        |
   +----+----+
   |         |
 MySQL 8   Redis
            |-- Cache
            `-- Queue
```

## Domain boundaries
- LMS: Course, Section/Module, Lesson, Enrollment, Progress, Quiz, Certificate, Instructor/Student workflows.
- CMS: Pages/content, Article/News/Tutorial/Activity, Homepage blocks, Menu, Media, SEO and approved content extensions.
- Commerce: Product, Variant, Cart, Voucher, Order, Payment, Stock Reservation, Digital Delivery, Instructor Wallet/Withdrawal.

Keep these domains conceptually separated inside one modular monolith.

## External provider boundaries
- Payment: Tripay / Xendit / Stripe behind existing payment contract/manager.
- Live Class target: `LiveClassService → LiveClassProviderInterface → ZoomProvider | MeetProvider`.
- Shipping target: `ShippingService → ShippingProviderInterface → RajaOngkirProvider`.
- Routing target: `RouteService → RouteProviderInterface → OpenRouteProvider`.
- YouTube: current embed use may remain simple; introduce deeper provider abstraction only when actual API capabilities require it.

No microservices/Kubernetes/Kafka/CQRS/Event Sourcing/GraphQL without a proven requirement and human approval.
