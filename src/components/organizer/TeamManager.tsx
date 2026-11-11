'use client';
import { useAuth } from '@/lib/auth-context';

import { UserMinus } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ResourceState } from '@/components/attendee/Shared';
import { formatWatDateTime } from '@/lib/campus-data';
import {
  fetchTeam,
  grantDoorStaff,
  inviteManager,
  removeMember,
  validateEmail,
  type TeamData,
  type TeamMember,
} from '@/lib/organizer-team-data';
import { ClubGate } from './OrganizerGate';
import styles from './Organizer.module.css';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function TeamManagerView({
  data,
  onInvite,
  onRemove,
  onGrant,
}: {
  data: TeamData;
  onInvite: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onGrant: (eventId: string, email: string) => Promise<void>;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [doorEvent, setDoorEvent] = useState('');
  const [doorEmail, setDoorEmail] = useState('');
  const [doorError, setDoorError] = useState<string | null>(null);
  const [doorBusy, setDoorBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  if (data.role !== 'OWNER') {
    return (
      <div className={styles.page}>
        <header className={styles.headerText}>
          <div className={styles.eyebrow}>{data.organizerName}</div>
          <h1>Team</h1>
        </header>
        <p className={styles.notice} role="alert">
          Only the club owner can manage the team.
        </p>
      </div>
    );
  }

  async function invite() {
    setNotice(null);
    const problem = validateEmail(inviteEmail);
    setInviteError(problem);
    if (problem) return;
    setInviteBusy(true);
    try {
      await onInvite(inviteEmail);
      setInviteEmail('');
      setNotice('Invite sent. They will appear as a manager once they accept.');
    } catch (error) {
      setInviteError(errorMessage(error, 'Could not send the invite. Please retry.'));
    } finally {
      setInviteBusy(false);
    }
  }

  async function grant() {
    setNotice(null);
    const problem = !doorEvent ? 'Choose an event.' : validateEmail(doorEmail);
    setDoorError(problem);
    if (problem) return;
    setDoorBusy(true);
    try {
      await onGrant(doorEvent, doorEmail);
      setDoorEmail('');
      setNotice('Door access granted until four hours after the event ends.');
    } catch (error) {
      setDoorError(errorMessage(error, 'Could not grant access. Please retry.'));
    } finally {
      setDoorBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await onRemove(removing.userId);
      setRemoving(null);
    } catch (error) {
      setRemoveError(errorMessage(error, 'Could not remove them. Please retry.'));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerText}>
        <div className={styles.eyebrow}>{data.organizerName}</div>
        <h1>Team</h1>
        <p className={styles.stepSubtitle}>
          Managers help run the club. Door staff only get the scanner for one event.
        </p>
      </header>

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      <section className={styles.group} aria-labelledby="members-heading">
        <h2 id="members-heading">Club team</h2>
        <ul className={styles.eventList}>
          {data.members.map((member) => (
            <li key={member.userId} className={styles.eventRow}>
              <div className={styles.eventMain}>
                <h3 className={styles.eventTitle}>
                  {member.displayName}
                  {member.role === 'OWNER' ? ' (you)' : ''}
                </h3>
                <div className={styles.eventMeta}>
                  <Badge variant="default">{member.role === 'OWNER' ? 'Owner' : 'Manager'}</Badge>
                  {member.status === 'INVITED' ? <Badge variant="warning">Invited</Badge> : null}
                  {member.emailHint ? (
                    <span className={styles.mono}>{member.emailHint}</span>
                  ) : null}
                </div>
              </div>
              {member.role === 'MANAGER' ? (
                <Button
                  variant="ghostDanger"
                  size="sm"
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => {
                    setRemoveError(null);
                    setRemoving(member);
                  }}
                >
                  <Icon icon={UserMinus} />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <form
          noValidate
          className={styles.panel}
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
        >
          <h3 className={styles.blockHeading}>Invite a manager</h3>
          <TextField
            label="Manager email"
            type="email"
            autoComplete="off"
            hint="Managers can create events, post stories and run the door. They cannot manage the team."
            value={inviteEmail}
            error={inviteError}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div className={styles.actions}>
            <Button type="submit" isLoading={inviteBusy}>
              Send invite
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.group} aria-labelledby="door-heading">
        <h2 id="door-heading">Door staff</h2>
        {data.doorStaff.length === 0 ? (
          <p className={styles.muted}>No one has door access right now.</p>
        ) : (
          <ul className={styles.eventList}>
            {data.doorStaff.map((grantItem) => (
              <li key={grantItem.id} className={styles.eventRow}>
                <div className={styles.eventMain}>
                  <h3 className={styles.eventTitle}>{grantItem.displayName}</h3>
                  <div className={styles.eventMeta}>
                    <span>{grantItem.eventTitle}</span>
                    <span className={styles.mono}>{grantItem.emailHint}</span>
                    <span>
                      Access ends {formatWatDateTime(grantItem.expiresAt).compactLabel} WAT
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data.grantableEvents.length === 0 ? (
          <p className={styles.notice}>
            Publish an event first, then you can give volunteers scanner access to it.
          </p>
        ) : (
          <form
            noValidate
            className={styles.panel}
            onSubmit={(e) => {
              e.preventDefault();
              void grant();
            }}
          >
            <h3 className={styles.blockHeading}>Grant door access</h3>
            <SelectField
              label="Event"
              value={doorEvent}
              onChange={(e) => setDoorEvent(e.target.value)}
            >
              <option value="">Choose an event…</option>
              {data.grantableEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Door staff email"
              type="email"
              autoComplete="off"
              hint="They only see the scanner and live count for this event, and access ends four hours after it finishes."
              value={doorEmail}
              error={doorError}
              onChange={(e) => setDoorEmail(e.target.value)}
            />
            <div className={styles.actions}>
              <Button type="submit" isLoading={doorBusy}>
                Grant door access
              </Button>
            </div>
          </form>
        )}
      </section>

      <Modal
        isOpen={removing !== null}
        title={removing ? `Remove ${removing.displayName}?` : 'Remove manager'}
        subtitle="They lose access to this club straight away."
        onClose={() => setRemoving(null)}
      >
        {removeError ? (
          <p role="alert" className={styles.errorList}>
            {removeError}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={removeBusy} onClick={confirmRemove}>
            Remove from team
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function TeamData({ slug }: { slug: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['organizer-team', slug, user?.id],
    queryFn: () => fetchTeam(slug),
  });
  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['organizer-team', slug] });
  return (
    <TeamManagerView
      data={query.data}
      onInvite={async (email) => {
        await inviteManager(slug, email);
        await refresh();
      }}
      onRemove={async (userId) => {
        await removeMember(slug, userId);
        await refresh();
      }}
      onGrant={async (eventId, email) => {
        await grantDoorStaff(slug, eventId, email);
        await refresh();
      }}
    />
  );
}

export function TeamManager({ slug }: { slug: string }) {
  return <ClubGate slug={slug}>{() => <TeamData slug={slug} />}</ClubGate>;
}
