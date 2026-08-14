export const errorMessages = {
  en: {
    email_required: 'Email is required',
    auth_error: 'Something went wrong signing you up. Please try again.',
    submission_failed: 'Something went wrong. Please try again.',
    required_fields: 'Please fill in all required fields.',
    must_be_logged_in: 'You must be logged in to comment.',
    comment_required: 'Comment cannot be empty.',
    comment_failed: 'Failed to post comment',
    division_closed: 'This division is no longer open for new team registrations.',
    club_not_found: 'Club not found',
    invalid_squad_number: 'Squad number must be a whole number greater than 0.',
    team_not_found: 'Team not found',
    must_agree_terms: 'You must agree to the registration terms.',
    login_required_child: 'You must be logged in to add a child.',
    parent_not_found: 'No parent account found for this login.',
  },
  es: {
    email_required: 'El correo electrónico es obligatorio',
    auth_error: 'Ocurrió un error al registrarte. Inténtalo de nuevo.',
    submission_failed: 'Algo salió mal. Inténtalo de nuevo.',
    required_fields: 'Por favor completa todos los campos obligatorios.',
    must_be_logged_in: 'Debes iniciar sesión para comentar.',
    comment_required: 'El comentario no puede estar vacío.',
    comment_failed: 'No se pudo publicar el comentario',
    division_closed: 'Esta división ya no acepta nuevos equipos.',
    club_not_found: 'Club no encontrado',
    invalid_squad_number: 'El número de camiseta debe ser un número entero mayor que 0.',
    team_not_found: 'Equipo no encontrado',
    must_agree_terms: 'Debes aceptar los términos de inscripción.',
    login_required_child: 'Debes iniciar sesión para añadir un hijo/a.',
    parent_not_found: 'No se encontró una cuenta de padre/madre para este inicio de sesión.',
  },
} as const

export function translateError(locale: 'en' | 'es', code: string): string {
  const dict: Record<string, string> = errorMessages[locale]
  return dict[code] ?? code
}
