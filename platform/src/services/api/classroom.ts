import { supabase } from '@/services/supabase/client';
import {
  getClassroomRolloutSettings,
  type ClassroomLearningEventEnvelope,
  type ClassroomRolloutSettings,
  validateLearningEventEnvelope,
} from '@/services/api/classroomContracts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type LearningInstitutionRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  institution_type: string;
  status: 'active' | 'paused' | 'archived';
  provider_config: JsonValue | null;
  created_at: string;
  updated_at: string;
};

type LearningCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  status: 'active' | 'paused' | 'archived';
};

type LearningCourseRow = {
  id: string;
  institution_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  difficulty: string | null;
  language: string | null;
  duration_minutes: number;
  pricing_type: 'free' | 'paid' | 'premium_only';
  reward_plan: JsonValue | null;
  status: 'draft' | 'published' | 'paused' | 'archived';
  metadata: JsonValue | null;
  created_at: string;
  updated_at: string;
};

type LearningModuleRow = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  metadata: JsonValue | null;
};

type LearningLessonRow = {
  id: string;
  module_id: string;
  lesson_type: string;
  title: string;
  content_url: string | null;
  duration_seconds: number;
  verification_config: JsonValue | null;
  sort_order: number;
  metadata: JsonValue | null;
};

type LearningEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped' | 'blocked';
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  metadata: JsonValue | null;
};

type LearningSessionRow = {
  id: string;
  user_id: string;
  enrollment_id: string | null;
  course_id: string;
  lesson_id: string | null;
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  focus_seconds: number;
  visibility_loss_count: number;
  average_playback_speed: number;
  risk_score: number;
  risk_status: 'clear' | 'review' | 'blocked';
  metadata: JsonValue | null;
  created_at: string;
  updated_at: string;
};

type LearningLessonProgressRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  watch_seconds: number;
  completion_percent: number;
  checkpoints: JsonValue | null;
  verified_at: string | null;
  status: 'in_progress' | 'completed' | 'review' | 'blocked';
  metadata: JsonValue | null;
  updated_at: string;
};

type LearningRewardEventRow = {
  id: string;
  user_id: string;
  enrollment_id: string | null;
  lesson_id: string | null;
  trigger_type: string;
  reward_amount: number;
  currency: string;
  status: 'pending' | 'held' | 'released' | 'claimed' | 'rejected' | 'reversed';
  hold_reason: string | null;
  metadata: JsonValue | null;
  created_at: string;
  updated_at: string;
};

type LearningWalletAccountRow = {
  id: string;
  user_id: string;
  balance: number;
  pending_balance: number;
  xp_balance: number;
  skill_points: number;
  created_at: string;
  updated_at: string;
};

type LearningCertificateRow = {
  id: string;
  user_id: string;
  enrollment_id: string | null;
  course_id: string;
  certificate_id: string;
  verification_id: string;
  qr_token: string;
  blockchain_hash: string | null;
  artifact_url: string | null;
  status: 'issued' | 'revoked' | 'invalid';
  issued_at: string;
  revoked_at: string | null;
  metadata: JsonValue | null;
  created_at: string;
  updated_at: string;
};

type LearningTutorMessageRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson_id: string | null;
  prompt: string;
  response: string;
  tokens_used: number;
  status: 'completed' | 'blocked';
  metadata: JsonValue | null;
  created_at: string;
};

interface ClassroomAntiCheatPolicy {
  heartbeatIntervalSeconds: number;
  minimumFocusRatio: number;
  maxPlaybackSpeed: number;
  sessionMinActiveSeconds: number;
  riskThresholdReview: number;
  riskThresholdBlock: number;
}

interface ClassroomWalletPolicy {
  minimumTransferAmount: number;
  cooldownHours: number;
  requireFraudClearance: boolean;
  requireRewardRelease: boolean;
}

const DEFAULT_ANTI_CHEAT_POLICY: ClassroomAntiCheatPolicy = {
  heartbeatIntervalSeconds: 30,
  minimumFocusRatio: 0.7,
  maxPlaybackSpeed: 1.5,
  sessionMinActiveSeconds: 300,
  riskThresholdReview: 45,
  riskThresholdBlock: 75,
};

const DEFAULT_WALLET_POLICY: ClassroomWalletPolicy = {
  minimumTransferAmount: 100,
  cooldownHours: 24,
  requireFraudClearance: true,
  requireRewardRelease: true,
};

export interface LearningProvider {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  institutionType: string;
  status: LearningInstitutionRow['status'];
  config: Record<string, unknown>;
}

export interface LearningCourseSummary {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  language: string;
  durationMinutes: number;
  pricingType: LearningCourseRow['pricing_type'];
  rewardPlan: Record<string, unknown>;
  status: LearningCourseRow['status'];
  institutionId: string;
  categoryId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LearningLesson {
  id: string;
  moduleId: string;
  lessonType: string;
  title: string;
  contentUrl?: string;
  durationSeconds: number;
  verificationConfig: Record<string, unknown>;
  sortOrder: number;
}

export interface LearningModule {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
  metadata: Record<string, unknown>;
  lessons: LearningLesson[];
}

export interface LearningCourseDetail extends LearningCourseSummary {
  modules: LearningModule[];
}

export interface LearningHomeFeedInput {
  userId?: string;
  limit?: number;
}

export interface LearningHomeFeed {
  recommended: LearningCourseSummary[];
  continueLearning: LearningEnrollmentSummary[];
  trending: LearningCourseSummary[];
  newCourses: LearningCourseSummary[];
}

export interface ListLearningCoursesFilters {
  search?: string;
  categoryId?: string;
  institutionId?: string;
  pricingType?: LearningCourseRow['pricing_type'];
  status?: LearningCourseRow['status'];
  limit?: number;
}

export interface LearningEnrollmentSummary {
  id: string;
  userId: string;
  courseId: string;
  status: LearningEnrollmentRow['status'];
  progressPercent: number;
  enrolledAt: string;
  completedAt?: string;
}

export interface StartLearningSessionInput {
  userId: string;
  enrollmentId?: string;
  courseId: string;
  lessonId?: string;
  source?: string;
}

export interface AppendLearningEventInput {
  userId: string;
  sessionId: string;
  courseId: string;
  lessonId?: string;
  event: ClassroomLearningEventEnvelope;
}

export interface CompleteLessonCheckpointInput {
  userId: string;
  lessonId: string;
  watchSeconds: number;
  completionPercent: number;
  checkpoint: Record<string, unknown>;
}

export interface LearningRewardEvaluationInput {
  userId: string;
  enrollmentId?: string;
  lessonId?: string;
  triggerType: string;
  rewardAmount: number;
  currency?: string;
  evidence: {
    sessionId?: string;
    completionPercent?: number;
    activeSeconds?: number;
    focusRatio?: number;
    playbackSpeed?: number;
  };
}

export interface LearningRewardEvaluation {
  eventId: string;
  status: LearningRewardEventRow['status'];
  riskStatus: 'clear' | 'review' | 'blocked';
  riskScore: number;
  reason: string;
}

export interface TransferLearningBalanceInput {
  userId: string;
  amount: number;
}

export interface IssueCertificateInput {
  userId: string;
  enrollmentId: string;
  courseId: string;
  artifactUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface LearningTutorInput {
  userId: string;
  courseId?: string;
  lessonId?: string;
  prompt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRecord(value: JsonValue | null | undefined): Record<string, unknown> {
  return isRecord(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

async function requireClassroomRollout(scope: 'learner' | 'admin' | 'reward' | 'wallet' | 'tutor'): Promise<ClassroomRolloutSettings> {
  const settings = await getClassroomRolloutSettings();
  if (!settings.enabled) {
    throw new Error('Classroom is not enabled.');
  }

  if (scope === 'learner' && !settings.allowLearnerRoutes) {
    throw new Error('Classroom learner routes are disabled.');
  }
  if (scope === 'admin' && !settings.allowAdminRoutes) {
    throw new Error('Classroom admin routes are disabled.');
  }
  if (scope === 'reward' && !settings.allowRewardPayouts) {
    throw new Error('Classroom reward payout is disabled.');
  }
  if (scope === 'wallet' && !settings.allowWalletTransfers) {
    throw new Error('Classroom wallet transfer is disabled.');
  }
  if (scope === 'tutor' && !settings.allowTutor) {
    throw new Error('Classroom tutor is disabled.');
  }

  return settings;
}

async function getPlatformSetting(key: string): Promise<unknown> {
  const { data, error } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle<{ value: unknown }>();
  if (error) {
    throw error;
  }
  return data?.value;
}

async function getAntiCheatPolicy(): Promise<ClassroomAntiCheatPolicy> {
  const value = await getPlatformSetting('classroom_anti_cheat_policy');
  if (!isRecord(value)) return DEFAULT_ANTI_CHEAT_POLICY;

  return {
    heartbeatIntervalSeconds: toNumber(value.heartbeatIntervalSeconds, DEFAULT_ANTI_CHEAT_POLICY.heartbeatIntervalSeconds),
    minimumFocusRatio: toNumber(value.minimumFocusRatio, DEFAULT_ANTI_CHEAT_POLICY.minimumFocusRatio),
    maxPlaybackSpeed: toNumber(value.maxPlaybackSpeed, DEFAULT_ANTI_CHEAT_POLICY.maxPlaybackSpeed),
    sessionMinActiveSeconds: toNumber(value.sessionMinActiveSeconds, DEFAULT_ANTI_CHEAT_POLICY.sessionMinActiveSeconds),
    riskThresholdReview: toNumber(value.riskThresholdReview, DEFAULT_ANTI_CHEAT_POLICY.riskThresholdReview),
    riskThresholdBlock: toNumber(value.riskThresholdBlock, DEFAULT_ANTI_CHEAT_POLICY.riskThresholdBlock),
  };
}

async function getWalletPolicy(): Promise<ClassroomWalletPolicy> {
  const value = await getPlatformSetting('classroom_wallet_policy');
  if (!isRecord(value)) return DEFAULT_WALLET_POLICY;

  return {
    minimumTransferAmount: toNumber(value.minimumTransferAmount, DEFAULT_WALLET_POLICY.minimumTransferAmount),
    cooldownHours: toNumber(value.cooldownHours, DEFAULT_WALLET_POLICY.cooldownHours),
    requireFraudClearance: toBoolean(value.requireFraudClearance, DEFAULT_WALLET_POLICY.requireFraudClearance),
    requireRewardRelease: toBoolean(value.requireRewardRelease, DEFAULT_WALLET_POLICY.requireRewardRelease),
  };
}

function mapProvider(row: LearningInstitutionRow): LearningProvider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? undefined,
    institutionType: row.institution_type,
    status: row.status,
    config: toRecord(row.provider_config),
  };
}

function mapCourseSummary(row: LearningCourseRow): LearningCourseSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    difficulty: row.difficulty ?? 'all_levels',
    language: row.language ?? 'en',
    durationMinutes: row.duration_minutes,
    pricingType: row.pricing_type,
    rewardPlan: toRecord(row.reward_plan),
    status: row.status,
    institutionId: row.institution_id,
    categoryId: row.category_id ?? undefined,
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function mapEnrollment(row: LearningEnrollmentRow): LearningEnrollmentSummary {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    status: row.status,
    progressPercent: row.progress_percent,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at ?? undefined,
  };
}

async function ensureWalletAccount(userId: string): Promise<LearningWalletAccountRow> {
  const { data: existing, error: existingError } = await supabase
    .from('learning_wallet_accounts')
    .select('id,user_id,balance,pending_balance,xp_balance,skill_points,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as LearningWalletAccountRow;
  }

  const { data: created, error: createError } = await supabase
    .from('learning_wallet_accounts')
    .insert({ user_id: userId })
    .select('id,user_id,balance,pending_balance,xp_balance,skill_points,created_at,updated_at')
    .single();

  if (createError) {
    throw createError;
  }

  return created as LearningWalletAccountRow;
}

function computeRiskScore(input: LearningRewardEvaluationInput, policy: ClassroomAntiCheatPolicy): { score: number; status: 'clear' | 'review' | 'blocked'; reason: string } {
  const completionPercent = input.evidence.completionPercent ?? 0;
  const activeSeconds = input.evidence.activeSeconds ?? 0;
  const focusRatio = input.evidence.focusRatio ?? 0;
  const playbackSpeed = input.evidence.playbackSpeed ?? 1;

  let score = 0;
  const reasons: string[] = [];

  if (completionPercent < 100) {
    score += 25;
    reasons.push('completion_below_required');
  }
  if (activeSeconds < policy.sessionMinActiveSeconds) {
    score += 30;
    reasons.push('active_seconds_below_threshold');
  }
  if (focusRatio < policy.minimumFocusRatio) {
    score += 25;
    reasons.push('focus_ratio_below_threshold');
  }
  if (playbackSpeed > policy.maxPlaybackSpeed) {
    score += 30;
    reasons.push('playback_speed_above_policy');
  }

  if (!reasons.length) {
    return { score: 0, status: 'clear', reason: 'anti_cheat_clear' };
  }

  if (score >= policy.riskThresholdBlock) {
    return { score, status: 'blocked', reason: reasons.join(',') };
  }

  if (score >= policy.riskThresholdReview) {
    return { score, status: 'review', reason: reasons.join(',') };
  }

  return { score, status: 'clear', reason: reasons.join(',') };
}

export async function listLearningProviders(): Promise<LearningProvider[]> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_institutions')
    .select('id,name,slug,logo_url,institution_type,status,provider_config,created_at,updated_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapProvider(row as LearningInstitutionRow));
}

export async function listLearningCourses(filters: ListLearningCoursesFilters = {}): Promise<LearningCourseSummary[]> {
  await requireClassroomRollout('learner');

  let query = supabase
    .from('learning_courses')
    .select('id,institution_id,category_id,title,description,difficulty,language,duration_minutes,pricing_type,reward_plan,status,metadata,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 24);

  if (filters.search?.trim()) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.institutionId) query = query.eq('institution_id', filters.institutionId);
  if (filters.pricingType) query = query.eq('pricing_type', filters.pricingType);

  const effectiveStatus = filters.status ?? 'published';
  query = query.eq('status', effectiveStatus);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => mapCourseSummary(row as LearningCourseRow));
}

export async function getLearningCourse(courseId: string): Promise<LearningCourseDetail | null> {
  await requireClassroomRollout('learner');

  const { data: course, error: courseError } = await supabase
    .from('learning_courses')
    .select('id,institution_id,category_id,title,description,difficulty,language,duration_minutes,pricing_type,reward_plan,status,metadata,created_at,updated_at')
    .eq('id', courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return null;

  const { data: moduleRows, error: moduleError } = await supabase
    .from('learning_course_modules')
    .select('id,course_id,title,sort_order,metadata')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (moduleError) throw moduleError;

  const moduleIds = (moduleRows ?? []).map((row) => row.id);
  let lessonRows: LearningLessonRow[] = [];

  if (moduleIds.length) {
    const { data: lessons, error: lessonError } = await supabase
      .from('learning_lessons')
      .select('id,module_id,lesson_type,title,content_url,duration_seconds,verification_config,sort_order,metadata')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true });

    if (lessonError) throw lessonError;
    lessonRows = (lessons ?? []) as LearningLessonRow[];
  }

  const lessonByModule = new Map<string, LearningLesson[]>();
  for (const lesson of lessonRows) {
    const bucket = lessonByModule.get(lesson.module_id) ?? [];
    bucket.push({
      id: lesson.id,
      moduleId: lesson.module_id,
      lessonType: lesson.lesson_type,
      title: lesson.title,
      contentUrl: lesson.content_url ?? undefined,
      durationSeconds: lesson.duration_seconds,
      verificationConfig: toRecord(lesson.verification_config),
      sortOrder: lesson.sort_order,
    });
    lessonByModule.set(lesson.module_id, bucket);
  }

  const modules = ((moduleRows ?? []) as LearningModuleRow[]).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    sortOrder: row.sort_order,
    metadata: toRecord(row.metadata),
    lessons: lessonByModule.get(row.id) ?? [],
  }));

  return {
    ...mapCourseSummary(course as LearningCourseRow),
    modules,
  };
}

export async function enrollInCourse(courseId: string, userId: string): Promise<LearningEnrollmentSummary> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_enrollments')
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        status: 'enrolled',
        progress_percent: 0,
      },
      { onConflict: 'user_id,course_id' },
    )
    .select('id,user_id,course_id,status,progress_percent,enrolled_at,completed_at,metadata')
    .single();

  if (error) throw error;
  return mapEnrollment(data as LearningEnrollmentRow);
}

export async function listLearningHomeFeed(input: LearningHomeFeedInput = {}): Promise<LearningHomeFeed> {
  await requireClassroomRollout('learner');

  const [recommended, trending, newest, enrollments] = await Promise.all([
    listLearningCourses({ status: 'published', limit: input.limit ?? 12 }),
    listLearningCourses({ status: 'published', limit: input.limit ?? 12 }),
    listLearningCourses({ status: 'published', limit: input.limit ?? 12 }),
    input.userId
      ? supabase
          .from('learning_enrollments')
          .select('id,user_id,course_id,status,progress_percent,enrolled_at,completed_at,metadata')
          .eq('user_id', input.userId)
          .in('status', ['enrolled', 'in_progress'])
          .order('updated_at', { ascending: false })
          .limit(input.limit ?? 12)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (enrollments.error) throw enrollments.error;

  return {
    recommended,
    trending,
    newCourses: newest,
    continueLearning: ((enrollments.data ?? []) as LearningEnrollmentRow[]).map((row) => mapEnrollment(row)),
  };
}

export async function startLearningSession(input: StartLearningSessionInput): Promise<LearningSessionRow> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_sessions')
    .insert({
      user_id: input.userId,
      enrollment_id: input.enrollmentId ?? null,
      course_id: input.courseId,
      lesson_id: input.lessonId ?? null,
      started_at: new Date().toISOString(),
      metadata: {
        source: input.source ?? 'web',
      },
    })
    .select('id,user_id,enrollment_id,course_id,lesson_id,started_at,ended_at,active_seconds,focus_seconds,visibility_loss_count,average_playback_speed,risk_score,risk_status,metadata,created_at,updated_at')
    .single();

  if (error) throw error;

  return data as LearningSessionRow;
}

export async function appendLearningEvent(input: AppendLearningEventInput): Promise<void> {
  await requireClassroomRollout('learner');

  validateLearningEventEnvelope(input.event);

  const { error } = await supabase.from('learning_events').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    course_id: input.courseId,
    lesson_id: input.lessonId ?? null,
    event_type: input.event.eventType,
    event_time: input.event.eventTime,
    payload: {
      schemaVersion: input.event.schemaVersion,
      ...input.event.payload,
    },
    source: input.event.source,
  });

  if (error) throw error;
}

export async function completeLessonCheckpoint(input: CompleteLessonCheckpointInput): Promise<LearningLessonProgressRow> {
  await requireClassroomRollout('learner');

  const { data: current, error: currentError } = await supabase
    .from('learning_lesson_progress')
    .select('id,user_id,lesson_id,watch_seconds,completion_percent,checkpoints,verified_at,status,metadata,updated_at')
    .eq('user_id', input.userId)
    .eq('lesson_id', input.lessonId)
    .maybeSingle();

  if (currentError) throw currentError;

  const existingCheckpoints = Array.isArray(current?.checkpoints) ? (current?.checkpoints as unknown[]) : [];
  const completionStatus = input.completionPercent >= 100 ? 'completed' : 'in_progress';
  const payload = {
    user_id: input.userId,
    lesson_id: input.lessonId,
    watch_seconds: Math.max(current?.watch_seconds ?? 0, input.watchSeconds),
    completion_percent: Math.max(current?.completion_percent ?? 0, input.completionPercent),
    checkpoints: [...existingCheckpoints, input.checkpoint],
    status: completionStatus,
    verified_at: completionStatus === 'completed' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('learning_lesson_progress')
    .upsert(payload, { onConflict: 'user_id,lesson_id' })
    .select('id,user_id,lesson_id,watch_seconds,completion_percent,checkpoints,verified_at,status,metadata,updated_at')
    .single();

  if (error) throw error;

  return data as LearningLessonProgressRow;
}

export async function getEnrollmentProgress(enrollmentId: string): Promise<{ enrollment: LearningEnrollmentSummary; lessons: LearningLessonProgressRow[] } | null> {
  await requireClassroomRollout('learner');

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('learning_enrollments')
    .select('id,user_id,course_id,status,progress_percent,enrolled_at,completed_at,metadata')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return null;

  const { data: lessons, error: lessonsError } = await supabase
    .from('learning_lesson_progress')
    .select('id,user_id,lesson_id,watch_seconds,completion_percent,checkpoints,verified_at,status,metadata,updated_at')
    .eq('user_id', enrollment.user_id)
    .order('updated_at', { ascending: false });

  if (lessonsError) throw lessonsError;

  return {
    enrollment: mapEnrollment(enrollment as LearningEnrollmentRow),
    lessons: (lessons ?? []) as LearningLessonProgressRow[],
  };
}

export async function submitQuizAttempt(input: {
  userId: string;
  enrollmentId?: string;
  quizId: string;
  score: number;
  answersPayload: Record<string, unknown>;
}): Promise<{ id: string; passed: boolean; score: number }> {
  await requireClassroomRollout('learner');

  const { data: quiz, error: quizError } = await supabase
    .from('learning_quizzes')
    .select('id,passing_score')
    .eq('id', input.quizId)
    .single<{ id: string; passing_score: number }>();

  if (quizError) throw quizError;

  const passed = input.score >= Number(quiz.passing_score ?? 70);

  const { data, error } = await supabase
    .from('learning_quiz_attempts')
    .insert({
      quiz_id: input.quizId,
      user_id: input.userId,
      enrollment_id: input.enrollmentId ?? null,
      score: input.score,
      passed,
      answers_payload: input.answersPayload,
    })
    .select('id,passed,score')
    .single();

  if (error) throw error;
  return data as { id: string; passed: boolean; score: number };
}

export async function submitAssignment(input: {
  userId: string;
  enrollmentId?: string;
  assignmentId: string;
  artifactUrl?: string;
  submissionPayload: Record<string, unknown>;
}): Promise<{ id: string; reviewStatus: string }> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_assignment_submissions')
    .insert({
      assignment_id: input.assignmentId,
      user_id: input.userId,
      enrollment_id: input.enrollmentId ?? null,
      artifact_url: input.artifactUrl ?? null,
      submission_payload: input.submissionPayload,
      review_status: 'pending',
    })
    .select('id,review_status')
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    reviewStatus: String(data.review_status),
  };
}

export async function finalizeCourseCompletion(input: {
  enrollmentId: string;
  userId: string;
  completionPercent: number;
}): Promise<LearningEnrollmentSummary> {
  await requireClassroomRollout('learner');

  const status = input.completionPercent >= 100 ? 'completed' : 'in_progress';
  const { data, error } = await supabase
    .from('learning_enrollments')
    .update({
      status,
      progress_percent: input.completionPercent,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', input.enrollmentId)
    .eq('user_id', input.userId)
    .select('id,user_id,course_id,status,progress_percent,enrolled_at,completed_at,metadata')
    .single();

  if (error) throw error;
  return mapEnrollment(data as LearningEnrollmentRow);
}

export async function evaluateLearningReward(input: LearningRewardEvaluationInput): Promise<LearningRewardEvaluation> {
  await requireClassroomRollout('reward');

  const policy = await getAntiCheatPolicy();
  const risk = computeRiskScore(input, policy);
  const status: LearningRewardEventRow['status'] = risk.status === 'blocked' ? 'rejected' : risk.status === 'review' ? 'held' : 'released';

  const { data, error } = await supabase
    .from('learning_reward_events')
    .insert({
      user_id: input.userId,
      enrollment_id: input.enrollmentId ?? null,
      lesson_id: input.lessonId ?? null,
      trigger_type: input.triggerType,
      reward_amount: input.rewardAmount,
      currency: input.currency ?? 'COIN',
      status,
      hold_reason: risk.status === 'clear' ? null : risk.reason,
      metadata: {
        riskScore: risk.score,
        riskStatus: risk.status,
        evidence: input.evidence,
      },
    })
    .select('id,status')
    .single();

  if (error) throw error;

  if (status === 'released') {
    const wallet = await ensureWalletAccount(input.userId);
    const nextBalance = wallet.balance + input.rewardAmount;

    const [walletUpdate, txInsert] = await Promise.all([
      supabase.from('learning_wallet_accounts').update({ balance: nextBalance }).eq('id', wallet.id),
      supabase.from('learning_wallet_transactions').insert({
        learning_wallet_account_id: wallet.id,
        transaction_type: 'accrual',
        amount: input.rewardAmount,
        reason: input.triggerType,
        reference_type: 'learning_reward_event',
        reference_id: data.id,
      }),
    ]);

    if (walletUpdate.error) throw walletUpdate.error;
    if (txInsert.error) throw txInsert.error;
  }

  return {
    eventId: String(data.id),
    status,
    riskStatus: risk.status,
    riskScore: risk.score,
    reason: risk.reason,
  };
}

export async function claimLearningReward(eventId: string, userId: string): Promise<LearningRewardEventRow> {
  await requireClassroomRollout('reward');

  const { data: reward, error: rewardError } = await supabase
    .from('learning_reward_events')
    .select('id,user_id,enrollment_id,lesson_id,trigger_type,reward_amount,currency,status,hold_reason,metadata,created_at,updated_at')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single();

  if (rewardError) throw rewardError;

  const row = reward as LearningRewardEventRow;
  if (row.status !== 'released') {
    throw new Error('Reward can only be claimed after release.');
  }

  const { data, error } = await supabase
    .from('learning_reward_events')
    .update({ status: 'claimed' })
    .eq('id', eventId)
    .eq('user_id', userId)
    .select('id,user_id,enrollment_id,lesson_id,trigger_type,reward_amount,currency,status,hold_reason,metadata,created_at,updated_at')
    .single();

  if (error) throw error;
  return data as LearningRewardEventRow;
}

export async function transferLearningBalance(input: TransferLearningBalanceInput): Promise<{ transferId: string; status: string }> {
  await requireClassroomRollout('wallet');

  const [policy, wallet] = await Promise.all([getWalletPolicy(), ensureWalletAccount(input.userId)]);

  if (input.amount < policy.minimumTransferAmount) {
    throw new Error(`Minimum transfer amount is ${policy.minimumTransferAmount}.`);
  }

  if (wallet.balance < input.amount) {
    throw new Error('Insufficient learning wallet balance.');
  }

  if (policy.requireRewardRelease) {
    const { count, error } = await supabase
      .from('learning_reward_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('status', 'held');
    if (error) throw error;
    if ((count ?? 0) > 0) {
      throw new Error('Transfer is blocked while held reward events exist.');
    }
  }

  if (policy.requireFraudClearance) {
    const { count, error } = await supabase
      .from('learning_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('risk_status', 'blocked');
    if (error) throw error;
    if ((count ?? 0) > 0) {
      throw new Error('Transfer is blocked by risk policy.');
    }
  }

  const { data: transfer, error: transferError } = await supabase
    .from('learning_wallet_transfers')
    .insert({
      user_id: input.userId,
      learning_amount: input.amount,
      transfer_status: 'completed',
      risk_status: 'clear',
      metadata: {
        policySnapshot: policy,
      },
    })
    .select('id,transfer_status')
    .single();

  if (transferError) throw transferError;

  const nextBalance = wallet.balance - input.amount;
  const [walletUpdate, txInsert] = await Promise.all([
    supabase.from('learning_wallet_accounts').update({ balance: nextBalance }).eq('id', wallet.id),
    supabase.from('learning_wallet_transactions').insert({
      learning_wallet_account_id: wallet.id,
      transaction_type: 'transfer_out',
      amount: input.amount,
      reason: 'learning_wallet_transfer_to_main',
      reference_type: 'learning_wallet_transfer',
      reference_id: transfer.id,
    }),
  ]);

  if (walletUpdate.error) throw walletUpdate.error;
  if (txInsert.error) throw txInsert.error;

  return {
    transferId: String(transfer.id),
    status: String(transfer.transfer_status),
  };
}

function randomToken(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function issueCertificate(input: IssueCertificateInput): Promise<LearningCertificateRow> {
  await requireClassroomRollout('reward');

  const certificateId = randomToken('CERT');
  const verificationId = randomToken('VERIFY');
  const qrToken = randomToken('QR');

  const { data, error } = await supabase
    .from('learning_certificates')
    .insert({
      user_id: input.userId,
      enrollment_id: input.enrollmentId,
      course_id: input.courseId,
      certificate_id: certificateId,
      verification_id: verificationId,
      qr_token: qrToken,
      artifact_url: input.artifactUrl ?? null,
      status: 'issued',
      metadata: input.metadata ?? {},
    })
    .select('id,user_id,enrollment_id,course_id,certificate_id,verification_id,qr_token,blockchain_hash,artifact_url,status,issued_at,revoked_at,metadata,created_at,updated_at')
    .single();

  if (error) throw error;

  return data as LearningCertificateRow;
}

export async function getCertificate(certificateId: string): Promise<LearningCertificateRow | null> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_certificates')
    .select('id,user_id,enrollment_id,course_id,certificate_id,verification_id,qr_token,blockchain_hash,artifact_url,status,issued_at,revoked_at,metadata,created_at,updated_at')
    .eq('id', certificateId)
    .maybeSingle();

  if (error) throw error;
  return (data as LearningCertificateRow | null) ?? null;
}

export async function verifyCertificate(verificationId: string): Promise<LearningCertificateRow | null> {
  const { data, error } = await supabase
    .from('learning_certificates')
    .select('id,user_id,enrollment_id,course_id,certificate_id,verification_id,qr_token,blockchain_hash,artifact_url,status,issued_at,revoked_at,metadata,created_at,updated_at')
    .eq('verification_id', verificationId)
    .maybeSingle();

  if (error) throw error;
  return (data as LearningCertificateRow | null) ?? null;
}

export async function askLearningTutor(input: LearningTutorInput): Promise<{ id: string; response: string }> {
  await requireClassroomRollout('tutor');

  const { data: history, error: historyError } = await supabase
    .from('learning_tutor_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (historyError) throw historyError;

  const dailyCount = history.count ?? 0;
  const response = `Tutor summary: ${input.prompt.trim().slice(0, 180)}${input.prompt.trim().length > 180 ? '...' : ''}`;

  const { data, error } = await supabase
    .from('learning_tutor_messages')
    .insert({
      user_id: input.userId,
      course_id: input.courseId ?? null,
      lesson_id: input.lessonId ?? null,
      prompt: input.prompt,
      response,
      tokens_used: Math.max(50, input.prompt.split(/\s+/).length * 2),
      status: 'completed',
      metadata: {
        dailyUsageCount: dailyCount + 1,
      },
    })
    .select('id,response')
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    response: String(data.response),
  };
}

export async function listLearningTutorHistory(userId: string, limit = 20): Promise<LearningTutorMessageRow[]> {
  await requireClassroomRollout('tutor');

  const { data, error } = await supabase
    .from('learning_tutor_messages')
    .select('id,user_id,course_id,lesson_id,prompt,response,tokens_used,status,metadata,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LearningTutorMessageRow[];
}

export async function listLearningCategories(): Promise<Array<{ id: string; name: string; slug: string; parentId?: string }>> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_categories')
    .select('id,name,slug,parent_id,sort_order,status')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as LearningCategoryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id ?? undefined,
  }));
}

export async function upsertLearningProvider(input: {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  institutionType: string;
  status: LearningInstitutionRow['status'];
  providerConfig?: Record<string, unknown>;
}): Promise<LearningProvider> {
  await requireClassroomRollout('admin');

  const payload = {
    id: input.id,
    name: input.name,
    slug: input.slug,
    logo_url: input.logoUrl ?? null,
    institution_type: input.institutionType,
    status: input.status,
    provider_config: input.providerConfig ?? {},
  };

  const { data, error } = await supabase
    .from('learning_institutions')
    .upsert(payload, { onConflict: 'slug' })
    .select('id,name,slug,logo_url,institution_type,status,provider_config,created_at,updated_at')
    .single();

  if (error) throw error;

  return mapProvider(data as LearningInstitutionRow);
}

export async function listClassroomAnalyticsDaily(limit = 30): Promise<Array<{ periodDate: string; dimensions: Record<string, unknown>; measures: Record<string, unknown> }>> {
  await requireClassroomRollout('admin');

  const { data, error } = await supabase
    .from('learning_analytics_daily')
    .select('period_date,dimensions,measures')
    .order('period_date', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    periodDate: String(row.period_date),
    dimensions: toRecord(row.dimensions as JsonValue),
    measures: toRecord(row.measures as JsonValue),
  }));
}

export async function listLearningLeaderboard(periodKey: string, limit = 100): Promise<Array<{ userId: string; score: number; rank: number }>> {
  await requireClassroomRollout('learner');

  const { data, error } = await supabase
    .from('learning_leaderboard_snapshots')
    .select('user_id,score,rank')
    .eq('period_key', periodKey)
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    score: Number(row.score ?? 0),
    rank: Number(row.rank ?? 0),
  }));
}
