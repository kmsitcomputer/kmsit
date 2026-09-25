<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Cookie\Middleware\EncryptCookies;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CourseController;
use App\Http\Controllers\Api\V1\QuizController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\ShopController;
use App\Http\Controllers\Api\V1\WalletController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\ArticleController;
use App\Http\Controllers\Api\V1\ContentController;
use App\Http\Controllers\Api\V1\HomepageController;
use App\Http\Controllers\Api\V1\MenuController;
use App\Http\Controllers\Api\V1\CertificateController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\AuditController;
use App\Http\Controllers\Api\V1\ContactController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CertificateTemplateController;
use App\Http\Controllers\Api\V1\BackupController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\InstallController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Middleware\AuthenticateApiUser;

Route::prefix('v1/auth')->middleware('web')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
    Route::post('/forgot-password', [PasswordResetController::class, 'request'])->middleware('throttle:5,1');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:5,1');

    Route::middleware('auth:web')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::prefix('v1/courses')->group(function () {
    Route::get('/', [CourseController::class, 'index']);
    Route::get('/{slug}', [CourseController::class, 'show'])->middleware([EncryptCookies::class, StartSession::class]);
    Route::post('/{slug}/enroll', [CourseController::class, 'enroll'])->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class, 'throttle:30,1']);
    Route::post('/{slug}/lessons/{lessonId}/complete', [CourseController::class, 'completeLesson'])->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class, 'throttle:60,1']);
    Route::get('/{slug}/lessons/{lessonId}/download', [CourseController::class, 'downloadLesson'])->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class, 'throttle:60,1']);
    Route::get('/{slug}/progress', [CourseController::class, 'progress'])->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class]);
});

Route::prefix('v1/instructor')->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class, \App\Http\Middleware\PreventMaintenanceAccess::class, \App\Http\Middleware\ValidateAuthEpoch::class])->group(function () {
    Route::get('/students', [\App\Http\Controllers\Api\V1\InstructorController::class, 'students']);
    Route::get('/sales', [\App\Http\Controllers\Api\V1\InstructorController::class, 'sales']);
    Route::get('/earnings', [\App\Http\Controllers\Api\V1\InstructorController::class, 'earnings']);
    Route::get('/quizzes', [\App\Http\Controllers\Api\V1\InstructorController::class, 'quizzes']);
    Route::get('/quiz-attempts', [\App\Http\Controllers\Api\V1\InstructorController::class, 'quizAttempts']);
    // Legacy read-only alias kept for existing clients.
    Route::post('/quiz-attempts', [\App\Http\Controllers\Api\V1\InstructorController::class, 'quizAttempts']);
    Route::get('/courses/{courseId}/progress', [\App\Http\Controllers\Api\V1\InstructorController::class, 'courseProgress']);
});

Route::prefix('v1')->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, \App\Http\Middleware\VerifyCsrfTokenForSession::class, \App\Http\Middleware\PreventMaintenanceAccess::class, \App\Http\Middleware\ValidateAuthEpoch::class])->group(function () {
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/my/enrollments', [\App\Http\Controllers\Api\V1\LearningController::class, 'enrollments']);
    Route::get('/my/quiz-attempts', [\App\Http\Controllers\Api\V1\LearningController::class, 'quizAttempts']);
    Route::get('/my/courses/{courseId}/status', [\App\Http\Controllers\Api\V1\LearningController::class, 'status']);
    Route::get('/payments/options', [OrderController::class, 'paymentOptions']);
    Route::get('/admin/ops/status', [\App\Http\Controllers\Api\V1\OperationsController::class, 'status']);
    Route::get('/quizzes/{quizId}', [QuizController::class, 'show']);
    Route::get('/courses/{courseId}/quizzes', [QuizController::class, 'byCourse']);
    Route::get('/certificates', [CertificateController::class, 'index']);
    Route::post('/courses/{courseId}/certificate', [CertificateController::class, 'issue']);
    Route::patch('/certificates/{id}/revoke', [CertificateController::class, 'revoke']);
    Route::get('/certificate-templates', [CertificateTemplateController::class, 'index']);
    Route::post('/certificate-templates', [CertificateTemplateController::class, 'store']);
    Route::put('/certificate-templates/{id}', [CertificateTemplateController::class, 'update']);
    Route::delete('/certificate-templates/{id}', [CertificateTemplateController::class, 'destroy']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'password']);
    Route::post('/profile/avatar', [ProfileController::class, 'avatar'])->middleware('throttle:20,1');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'read']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::get('/admin/audit-logs', [AuditController::class, 'index']);
    Route::get('/admin/backup', [BackupController::class, 'export']);
    Route::get('/admin/contact-messages', [ContactController::class, 'index']);
    Route::post('/quizzes/{quizId}/attempts', [QuizController::class, 'start'])->middleware('throttle:30,1');
    Route::post('/quiz-attempts/{attemptId}/submit', [QuizController::class, 'submit'])->middleware('throttle:10,1');
    Route::post('/orders/course', [OrderController::class, 'storeCourse']);
    Route::post('/orders/shop', [OrderController::class, 'storeShop']);
    Route::post('/orders/{orderId}/cancel', [OrderController::class, 'cancel']);
    Route::get('/orders/{orderId}', [OrderController::class, 'show']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/payments', [OrderController::class, 'payments']);
    Route::get('/payments/webhook-logs', [OrderController::class, 'webhookLogs']);
    Route::post('/orders/{orderId}/payment', [OrderController::class, 'initiatePayment'])->middleware('throttle:10,1');
    Route::get('/shop/cart', [ShopController::class, 'cart']);
    Route::post('/shop/cart', [ShopController::class, 'add'])->middleware('throttle:60,1');
    Route::post('/shop/voucher/validate', [ShopController::class, 'validateVoucher'])->middleware('throttle:30,1');
    Route::put('/shop/cart/{itemId}', [ShopController::class, 'update']);
    Route::delete('/shop/cart/{itemId}', [ShopController::class, 'remove']);
    Route::get('/shop/digital-deliveries', [ShopController::class, 'digitalDeliveries']);
    Route::get('/shop/digital-deliveries/{deliveryId}/download', [ShopController::class, 'download']);
    Route::get('/wallet', [WalletController::class, 'summary']);
    Route::get('/wallet/ledger', [WalletController::class, 'ledger']);
    Route::get('/wallet/withdrawals', [WalletController::class, 'myWithdrawals']);
    Route::post('/wallet/withdrawals', [WalletController::class, 'requestWithdrawal'])->middleware('throttle:10,1');
    Route::patch('/wallet/withdrawals/{withdrawalId}', [WalletController::class, 'setStatus']);
    Route::get('/admin/withdrawals', [WalletController::class, 'withdrawals']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::put('/settings/bulk', [SettingsController::class, 'updateMany']);
    Route::get('/settings', [SettingsController::class, 'admin']);
    Route::get('/settings/payment', [SettingsController::class, 'payment']);
    Route::put('/settings/payment', [SettingsController::class, 'updatePayment']);
    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media', [MediaController::class, 'upload'])->middleware('throttle:30,1');
    Route::delete('/media/{id}', [MediaController::class, 'destroy']);

    Route::get('/admin/courses', [CourseController::class, 'adminIndex']);
    Route::get('/admin/courses/{id}', [CourseController::class, 'adminShow']);
    Route::post('/admin/courses', [CourseController::class, 'store']);
    Route::put('/admin/courses/{id}', [CourseController::class, 'update']);
    Route::delete('/admin/courses/{id}', [CourseController::class, 'destroy']);
    Route::post('/admin/courses/{id}/submit', [CourseController::class, 'submit']);
    Route::patch('/admin/courses/{id}/moderate', [CourseController::class, 'moderate']);

    Route::get('/admin/quizzes', [QuizController::class, 'adminIndex']);
    Route::get('/admin/quizzes/{id}', [QuizController::class, 'adminShow']);
    Route::post('/admin/quizzes', [QuizController::class, 'store']);
    Route::put('/admin/quizzes/{id}', [QuizController::class, 'update']);
    Route::delete('/admin/quizzes/{id}', [QuizController::class, 'destroy']);
    Route::get('/admin/quizzes/{id}/attempts', [QuizController::class, 'attempts']);

    Route::get('/admin/vouchers', [\App\Http\Controllers\Api\V1\VoucherController::class, 'index']);
    Route::post('/admin/vouchers', [\App\Http\Controllers\Api\V1\VoucherController::class, 'store']);
    Route::put('/admin/vouchers/{id}', [\App\Http\Controllers\Api\V1\VoucherController::class, 'update']);
    Route::delete('/admin/vouchers/{id}', [\App\Http\Controllers\Api\V1\VoucherController::class, 'destroy']);

    Route::get('/admin/users', [\App\Http\Controllers\Api\V1\UserController::class, 'index']);
    Route::post('/admin/users', [\App\Http\Controllers\Api\V1\UserController::class, 'store']);
    Route::put('/admin/users/{id}', [\App\Http\Controllers\Api\V1\UserController::class, 'update']);
    Route::delete('/admin/users/{id}', [\App\Http\Controllers\Api\V1\UserController::class, 'destroy']);
    Route::patch('/admin/users/{id}/approve-instructor', [\App\Http\Controllers\Api\V1\UserController::class, 'approveInstructor']);
    Route::patch('/admin/contact-messages/{id}', [ContactController::class, 'update']);
    foreach (['news', 'tutorials', 'activities', 'pages'] as $contentType) {
        Route::get('/admin/content/' . $contentType, [ContentController::class, 'adminIndex'])->defaults('type', $contentType)->name('admin.' . $contentType . '.index');
        Route::post('/' . $contentType, [ContentController::class, 'store'])->defaults('type', $contentType);
        Route::put('/' . $contentType . '/{id}', [ContentController::class, 'update'])->defaults('type', $contentType);
        Route::delete('/' . $contentType . '/{id}', [ContentController::class, 'destroy'])->defaults('type', $contentType);
    }
    Route::post('/articles', [ArticleController::class, 'store']);
    Route::get('/admin/products', [ProductController::class, 'adminIndex']);
    Route::post('/admin/products', [ProductController::class, 'store']);
    Route::put('/admin/products/{id}', [ProductController::class, 'update']);
    Route::delete('/admin/products/{id}', [ProductController::class, 'destroy']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{id}', [CategoryController::class, 'update']);
    Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);
    Route::get('/admin/content/articles', [ContentController::class, 'adminIndex'])->defaults('type', 'articles');
    Route::post('/homepage/blocks', [HomepageController::class, 'store']);
    Route::get('/admin/homepage/blocks', [HomepageController::class, 'admin']);
    Route::put('/homepage/blocks/{id}', [HomepageController::class, 'update']);
    Route::delete('/homepage/blocks/{id}', [HomepageController::class, 'destroy']);
    Route::get('/admin/menus', [MenuController::class, 'adminIndex']);
    Route::post('/menus', [MenuController::class, 'storeMenu']);
    Route::post('/menus/items', [MenuController::class, 'storeItem']);
    Route::put('/menus/items/{id}', [MenuController::class, 'updateItem']);
    Route::delete('/menus/items/{id}', [MenuController::class, 'destroyItem']);
    Route::put('/articles/{id}', [ContentController::class, 'update'])->defaults('type', 'articles');
    Route::delete('/articles/{id}', [ContentController::class, 'destroy'])->defaults('type', 'articles');
});

Route::post('/v1/payments/webhook/{gateway}', [OrderController::class, 'webhook'])->middleware('throttle:120,1');
Route::get('/v1/shop/products', [ShopController::class, 'products']);
Route::get('/v1/categories', [CategoryController::class, 'index']);
Route::get('/v1/settings/public', [SettingsController::class, 'public']);
Route::get('/v1/search', SearchController::class)->middleware('throttle:60,1');
Route::post('/v1/contact', [ContactController::class, 'store'])->middleware('throttle:5,1');
Route::get('/v1/install/status', [InstallController::class, 'status']);
Route::get('/v1/install/requirements', [InstallController::class, 'requirements']);
Route::post('/v1/install/test-db', [InstallController::class, 'testDb'])->middleware(['throttle:10,1']);
Route::post('/v1/install/configure', [InstallController::class, 'configure'])->middleware(['throttle:5,1']);
Route::post('/v1/install', [InstallController::class, 'install'])->middleware(['throttle:3,1']);
Route::get('/v1/homepage/blocks', [HomepageController::class, 'index']);
Route::get('/v1/menus', [MenuController::class, 'index']);
Route::get('/v1/certificates/verify/{number}', [CertificateController::class, 'verify'])->middleware('throttle:60,1');
Route::get('/v1/articles', [ArticleController::class, 'index']);
Route::get('/v1/articles/{slug}', [ArticleController::class, 'show']);
foreach (['news', 'tutorials', 'activities', 'pages'] as $contentType) {
    Route::get('/v1/' . $contentType, [ContentController::class, 'index'])->defaults('type', $contentType);
    Route::get('/v1/' . $contentType . '/{slug}', [ContentController::class, 'show'])->defaults('type', $contentType);
}

Route::get('/health', function () {
    $database = 'unavailable';

    try {
        DB::connection()->getPdo();
        $database = 'ok';
    } catch (Throwable) {
        // Keep the endpoint useful while the production database is being configured.
    }

    return response()->json([
        'status' => $database === 'ok' ? 'ok' : 'degraded',
        'app' => config('app.name'),
        'environment' => app()->environment(),
        'database' => $database,
        'timestamp' => now()->toISOString(),
    ], $database === 'ok' ? 200 : 503);
});
