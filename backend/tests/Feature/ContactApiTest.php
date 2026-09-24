<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_message_requires_valid_fields(): void
    {
        $this->postJson('/api/v1/contact', ['name' => 'A', 'email' => 'bad', 'body' => ''])->assertStatus(422);
        $this->postJson('/api/v1/contact', ['name' => 'A', 'email' => 'visitor@example.com', 'subject' => 'Tanya', 'body' => 'Halo'])->assertCreated()->assertJsonPath('message', 'Pesan berhasil dikirim.');
        $this->assertDatabaseHas('contact_messages', ['email' => 'visitor@example.com', 'is_read' => 0]);
    }
}
