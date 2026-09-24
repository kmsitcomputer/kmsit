<?php

namespace Tests\Feature;

use App\Models\{Role, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class UserAuthorizationPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['super_admin', 'admin', 'instructor', 'student'] as $role) {
            Role::firstOrCreate(['role_key' => $role], ['id' => Str::random(12), 'name' => $role, 'permissions' => []]);
        }
    }

    public static function accessMatrix(): array
    {
        return [
            ['super_admin', [], true, true],
            ['admin', ['manage_students', 'manage_instructors'], true, true],
            ['admin', ['manage_students'], true, false],
            ['admin', ['manage_instructors'], false, true],
            ['admin', [], false, false],
            ['instructor', ['*'], false, false],
            ['student', ['*'], false, false],
        ];
    }

    #[DataProvider('accessMatrix')]
    public function test_user_management_access_matrix(string $role, array $permissions, bool $students, bool $instructors): void
    {
        Role::where('role_key', $role)->firstOrFail()->update(['permissions' => $permissions]);
        $actor = $this->user($role);
        $student = $this->user('student');
        $instructor = $this->user('instructor');
        $this->actingAs($actor, 'sanctum');
        $this->getJson('/api/v1/admin/users')->assertStatus($students || $instructors ? 200 : 403);
        foreach ([[$student, $students], [$instructor, $instructors]] as [$target, $allowed]) {
            $this->putJson('/api/v1/admin/users/' . $target->id, ['status' => 'suspended'])->assertStatus($allowed ? 200 : 403);
            $this->putJson('/api/v1/admin/users/' . $target->id, ['status' => 'active'])->assertStatus($allowed ? 200 : 403);
            $this->postJson('/api/v1/admin/users', $this->creation($target->role_key))->assertStatus($allowed ? 201 : 403);
        }
        $this->patchJson('/api/v1/admin/users/' . $instructor->id . '/approve-instructor', ['approved' => true])
            ->assertStatus($instructors ? 200 : 403);
        $this->deleteJson('/api/v1/admin/users/' . $student->id)->assertStatus($students ? 200 : 403);
    }

    public function test_student_manager_cannot_access_instructors_or_promote_into_unmanaged_roles(): void
    {
        $admin = $this->admin(['manage_students']);
        $student = $this->user('student');
        $instructor = $this->user('instructor');
        $super = $this->user('super_admin');
        $peer = $this->user('admin');
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/users')->assertOk()
            ->assertJsonMissing(['id' => $instructor->id])->assertJsonMissing(['id' => $super->id])->assertJsonMissing(['id' => $peer->id]);
        foreach (['instructor', 'admin', 'super_admin'] as $role) {
            $this->putJson('/api/v1/admin/users/' . $student->id, ['role_key' => $role])->assertForbidden();
        }
        $this->putJson('/api/v1/admin/users/' . $instructor->id, ['role_key' => 'student'])->assertForbidden();
        $this->assertSame('student', $student->fresh()->role_key);
    }

    public function test_admin_cannot_modify_or_delete_privileged_accounts_even_without_role_field(): void
    {
        $admin = $this->admin(['manage_students', 'manage_instructors']);
        $this->actingAs($admin, 'sanctum');
        foreach (['super_admin', 'admin'] as $role) {
            $target = $this->user($role);
            foreach ([['status' => 'suspended'], ['password' => 'Changed-pass-123', 'password_confirmation' => 'Changed-pass-123'], ['role_key' => 'student']] as $data) {
                $this->putJson('/api/v1/admin/users/' . $target->id, $data)->assertForbidden();
            }
            $this->deleteJson('/api/v1/admin/users/' . $target->id)->assertForbidden();
            $this->assertSame($role, $target->fresh()->role_key);
            $this->assertSame('active', $target->fresh()->status);
            $this->postJson('/api/v1/admin/users', $this->creation($role))->assertForbidden();
        }
    }

    public function test_role_transition_requires_both_permissions_and_super_admin_retains_access(): void
    {
        $admin = $this->admin(['manage_students', 'manage_instructors']);
        $target = $this->user('student');
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/admin/users/' . $target->id, ['role_key' => 'instructor'])
            ->assertOk()->assertJsonPath('user.role_key', 'instructor');
        $super = $this->user('super_admin');
        $this->actingAs($super, 'sanctum')->putJson('/api/v1/admin/users/' . $target->id, ['role_key' => 'super_admin'])
            ->assertOk()->assertJsonPath('user.role_key', 'super_admin');
        $this->postJson('/api/v1/admin/users', $this->creation('admin'))->assertCreated();
        $this->deleteJson('/api/v1/admin/users/' . $target->id)->assertOk();
    }

    public function test_self_delete_and_promotion_are_protected_but_authorized_self_suspend_remains_allowed(): void
    {
        $admin = $this->admin(['manage_students']);
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/v1/admin/users/' . $admin->id)
            ->assertStatus(422)->assertJsonPath('message', 'Tidak dapat menghapus akun sendiri.');
        $this->putJson('/api/v1/admin/users/' . $admin->id, ['role_key' => 'super_admin'])->assertForbidden();
        $this->putJson('/api/v1/admin/users/' . $admin->id, ['status' => 'suspended'])->assertOk();
        $super = $this->user('super_admin');
        $this->actingAs($super, 'sanctum')->deleteJson('/api/v1/admin/users/' . $super->id)->assertStatus(422);
    }

    public function test_missing_record_semantics_and_approval_record_type_are_preserved(): void
    {
        $admin = $this->admin(['manage_students', 'manage_instructors']);
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/admin/users/missing', ['name' => 'Test'])->assertNotFound();
        $this->deleteJson('/api/v1/admin/users/missing')->assertNotFound();
        $this->patchJson('/api/v1/admin/users/missing/approve-instructor', ['approved' => true])->assertNotFound();
        $student = $this->user('student');
        $this->patchJson('/api/v1/admin/users/' . $student->id . '/approve-instructor', ['approved' => true])->assertNotFound();
        $this->actingAs($student, 'sanctum')->putJson('/api/v1/admin/users/missing', [])->assertForbidden()
            ->assertJsonPath('message', 'Tidak memiliki permission.');
    }

    private function admin(array $permissions): User
    {
        Role::where('role_key', 'admin')->firstOrFail()->update(['permissions' => $permissions]);
        return $this->user('admin');
    }

    private function user(string $role): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => 'Fixture',
            'email' => Str::lower(Str::random(12)) . '@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
    }

    private function creation(string $role): array
    {
        return ['name' => 'Created', 'email' => Str::lower(Str::random(12)) . '@example.test', 'role_key' => $role,
            'password' => 'Strong-pass-123', 'password_confirmation' => 'Strong-pass-123'];
    }
}
