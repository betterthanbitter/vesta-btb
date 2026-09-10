/**
 * The Platinum introduction video.
 *
 * One component for the directory card and the profile hero, so the video a
 * consumer sees on the listing is the same one waiting on the profile when
 * they click through — it carries over rather than being rebuilt twice and
 * drifting apart. The photo is the poster frame until a video is produced.
 */
export default function IntroVideo({
  name, photo, duration, className = '',
}: { name: string; photo?: string; duration?: string; className?: string }) {
  return (
    <div className={`vid ${className}`.trim()} role="img" aria-label={`Video introduction from ${name}`}>
      {photo && <img className="vposter" src={photo} alt="" />}
      <div className="play"><i /></div>
      <div className="vlab">
        <span>Meet {name.split(' ')[0]}</span>
        {duration && <span className="vdur">{duration}</span>}
      </div>
    </div>
  );
}
