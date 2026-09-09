/**
 * What each tier lets a professional DO.
 *
 * The tier is not a badge. It decides what appears on the page, and that is
 * what makes the price defensible. Everything the directory renders reads
 * these entitlements — no screen should ever test the tier name directly,
 * because that is how "Platinum gets a video" ends up implemented in four
 * places and changed in three.
 */

export type Tier = 'standard' | 'premium' | 'platinum';

export interface Entitlements {
  /** Name, credential, firm, contact link. Everyone gets this. */
  listing: true;
  /** Photo and biography on the directory card. */
  photo: boolean;
  /** Their produced content library renders on the listing itself. */
  contentLibrary: boolean;
  /** The two-minute introduction video. */
  introVideo: boolean;
  /** Broadcasts, featured posts, Resource Library placement. */
  communityPlacement: boolean;
  /** May host live Vesta events. */
  hostsEvents: boolean;
  /** Holds the exclusive seat for their category in their hub. */
  exclusiveSeat: boolean;
  /** Professional Content Hub hosting included rather than charged. */
  hubHostingIncluded: boolean;
  /** Sort weight on the directory page — higher is nearer the top. */
  placementWeight: number;
}

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  standard: {
    listing: true,
    // A face is not a paid privilege. Someone choosing who to trust with their
    // divorce should see who they are looking at, whatever the professional
    // pays. What Premium buys above this is the bio, the content library and
    // the size of the card — not the existence of a photograph.
    photo: true,
    contentLibrary: false,
    introVideo: false,
    communityPlacement: false,
    hostsEvents: false,
    exclusiveSeat: false,
    hubHostingIncluded: false,
    placementWeight: 0,
  },
  premium: {
    listing: true,
    photo: true,
    contentLibrary: true,
    communityPlacement: true,
    introVideo: false,
    hostsEvents: false,
    exclusiveSeat: false,
    hubHostingIncluded: false,
    placementWeight: 10,
  },
  platinum: {
    listing: true,
    photo: true,
    contentLibrary: true,
    communityPlacement: true,
    introVideo: true,
    hostsEvents: true,
    exclusiveSeat: true,
    hubHostingIncluded: true,
    placementWeight: 20,
  },
};

/**
 * The gap a professional sees when they look at their own page — the reason
 * to upgrade, stated as things rather than as a price. The directory shows
 * this to the professional; it is never shown to a consumer.
 */
export function whatUpgradingAdds(from: Tier, to: Tier): (keyof Entitlements)[] {
  const a = ENTITLEMENTS[from];
  const b = ENTITLEMENTS[to];
  return (Object.keys(b) as (keyof Entitlements)[]).filter(
    (k) => typeof b[k] === 'boolean' && b[k] === true && a[k] === false,
  );
}
