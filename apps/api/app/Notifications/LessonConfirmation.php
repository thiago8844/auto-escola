<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LessonConfirmation extends Notification
{
    public function __construct(public readonly string $subject, public readonly string $body) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)->subject($this->subject);

        foreach (explode("\n", $this->body) as $line) {
            if ($line !== '') {
                $message->line($line);
            }
        }

        return $message;
    }
}
