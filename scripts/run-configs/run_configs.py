"""Build the "How this was run" previews for the design-choices post.

Reads the SDDC repo at a pinned commit (with `git show`, so the checkout is never
touched) and writes one JSON entry per experiment question: the run commands from
the worked example's README, the swept axes in plain words, the fixed settings, the
sweep YAML and the recipe configs it composes, each with a GitHub link at that commit.

Usage:
  uv run --no-project --with pyyaml python scripts/run-configs/run_configs.py \
    ~/sddc --sha 3836162 --github https://github.com/patrickpynadath1/sddc \
    > src/data/run_configs.json
Rerun after the repo changes (new --sha) and commit the JSON.
"""
import argparse, json, re, subprocess, sys

import yaml

# Plain names for every sweeper value the post's sweeps use. An unmapped value is an
# error, so a renamed config cannot slip through as a raw key.
NAMES = {
    'task': {'battery/sudoku_hard': 'Sudoku-hard', 'battery/text8': 'text8',
             'battery/tinystories_bpe': 'TinyStories BPE'},
    'ablation_path': {'gaussian_cdcd': 'Gaussian (CDCD clock)', 'masked_elbo': 'masked (ELBO)',
                      'uniform': 'uniform', 'gaussian': 'Gaussian', 'simplex': 'simplex',
                      'spherical': 'spherical', 'spherical_vmf': 'vMF'},
    'feedback': {'none': '8L', 'expected_embedding': '8L + SC', 'double_depth': '16L'},
    'bpe.vocabulary_size': {v: v for v in ['260', '500', '1000', '5000', '10000']},
    'ladder_recipe': {'gaussian': 'Gaussian', 'gaussian_sc': 'Gaussian + SC', 'masked': 'masked',
                      'masked_sc': 'masked + SC', 'uniform': 'uniform', 'uniform_sc': 'uniform + SC',
                      'ar': 'autoregressive'},
    'block': {'encoder1_decoder8': 'enc 1 / dec 8', 'encoder2_decoder8': 'enc 2 / dec 8',
              'encoder4_decoder8': 'enc 4 / dec 8', 'encoder8_decoder8': 'enc 8 / dec 8',
              'encoder8_decoder1': 'enc 8 / dec 1', 'encoder8_decoder2': 'enc 8 / dec 2',
              'encoder8_decoder4': 'enc 8 / dec 4', 'raw_context': 'no encoder (raw context)',
              'shared_transformer': 'block diffusion, one shared 8-layer network'},
}
AXIS_LABEL = {'task': 'Task', 'ablation_path': 'Corruption', 'feedback': 'Depth / SC',
              'bpe.vocabulary_size': 'Vocabulary', 'ladder_recipe': 'Recipe', 'block': 'Block model'}

FIVE = 'five samplers (native, native greedy, EB greedy, renoise, renoise greedy)'
COMMON_FIXED = ['20k training steps, batch 256, 8 layers × 512 wide unless the axis says 16L',
                f'128 NFE per sequence; {FIVE}, each tuned on validation',
                'one training seed; the validation winner is scored once on the test split (seeds 1041, 1042)']
RENOISE_NOTE = 'In hybrid_renoising.yaml the renoise policies are named renoising and renoising_greedy; the post calls them renoise sample and renoise greedy.'
COMMON = ('configs/sweep/common.yaml', ['trainer', 'loader', 'training', 'lr_scheduler', 'optimizer'], ['preparation.evaluation'])

ab = lambda *names: [f'configs/ablation_path/{n}.yaml' for n in names]
fb = lambda *names: [f'configs/feedback/{n}.yaml' for n in names]

SPEC = [
    dict(id='sc-vs-depth', question='Is self conditioning just a deeper network?',
         dir='experiments/sc-vs-depth', sweep='configs/sweep/sc_vs_depth.yaml',
         fixed=COMMON_FIXED + ['masked uses the ELBO weighting; Gaussian uses the CDCD learned clock'],
         groups=[('Defaults', [COMMON, 'configs/experiment/corruption_factorial.yaml']),
                 ('Corruption', ab('gaussian_cdcd', 'masked_elbo', 'uniform') + ['configs/objective/masked_elbo.yaml', 'configs/path_schedule/cdcd.yaml']),
                 ('Depth / SC', fb('none', 'expected_embedding', 'double_depth')),
                 ('Samplers', ['configs/inference_policies/hybrid_renoising.yaml'])],
         notes=[RENOISE_NOTE]),
    dict(id='sc-sampler-choice', question='Does self conditioning change how the model should be sampled?',
         dir='experiments/sc-sampler-choice', readme_section='Analysis only', see='sc-vs-depth',
         fixed=['no new training: reads the validation score of every sampler in the sc-vs-depth runs',
                'test split untouched here; it is used once per model inside sc-vs-depth'],
         notes=[RENOISE_NOTE]),
    dict(id='tokenizer-ladder', question='Does the tokenizer change the picture?',
         dir='experiments/tokenizer-ladder', sweep='configs/sweep/tokenizer_ladder.yaml',
         fixed=['20k training steps, batch 256, 8 layers × 512 wide; sequence length set per vocabulary so every story fits',
                f'128 NFE for diffusion; {FIVE}; AR tunes temperature sampling and greedy decoding, one call per token',
                'one training seed; the validation winner is scored once on the test split (seeds 1041, 1042)',
                'masked uses the ELBO weighting; Gaussian uses the CDCD learned clock'],
         groups=[('Recipes', [f'configs/ladder_recipe/{n}.yaml' for n in ['gaussian', 'gaussian_sc', 'masked', 'masked_sc', 'uniform', 'uniform_sc', 'ar']]),
                 ('Samplers', ['configs/inference_policies/hybrid_renoising.yaml', 'configs/inference_policies/autoregressive.yaml']),
                 ('Tokenizers', ['configs/task/battery/tinystories_bpe.yaml', 'artifacts/tokenizers/tinystories-bpe/README.md'])],
         notes=['Each ladder recipe composes configs/sweep/common.yaml itself (see the sc-vs-depth panel for its settings).',
                'Tokenizers: artifacts/tokenizers/tinystories-bpe/ holds bpe-{260,500,1000,5000,10000}.json with SHA256SUMS.',
                RENOISE_NOTE]),
    dict(id='continuous-schedules', question='Continuous Noise Schedules',
         dir='experiments/continuous-schedules', sweep='configs/sweep/continuous_schedules.yaml',
         names={'feedback': ('SC', {'none': 'no SC', 'expected_embedding': 'SC'})},
         fixed=['20k training steps, batch 256, 8 layers × 512 wide', COMMON_FIXED[1], COMMON_FIXED[2], 'every recipe learns its clock with CDCD'],
         groups=[('Defaults', [COMMON, 'configs/experiment/corruption_factorial.yaml']),
                 ('Corruption', ab('gaussian', 'simplex', 'spherical', 'spherical_vmf') + ['configs/path_schedule/cdcd.yaml']),
                 ('SC', fb('none', 'expected_embedding')),
                 ('Samplers', ['configs/inference_policies/hybrid_renoising.yaml'])],
         notes=['The schedule panels (Figures H, I, J) come from experiments/continuous-schedules/schedule_report.py and corruption_report.py, measured on the earlier ruqi6000 checkpoints of the same recipes. The scores in Figure E come from the run above.',
                RENOISE_NOTE]),
    dict(id='block-encoder-decoder', question='Block Diffusion: Scale the Encoder or the Decoder?',
         dir='experiments/block-encoder-decoder', sweep='configs/sweep/block_encoder_decoder.yaml',
         fixed=['masked block diffusion (MDLM loss), block size 32, time-conditioned AdaLN, no SC',
                '20k updates of 256 sequences; one training seed',
                '128 NFE budget (Sudoku uses 84: its first two blocks are the given puzzle)', 'native and native greedy samplers only (inline in the sweep), tuned on validation; winner tested once'],
         groups=[('Defaults', [COMMON, 'configs/experiment/e2d2.yaml']),
                 ('Block models', [f'configs/block/{n}.yaml' for n in ['encoder1_decoder8', 'encoder2_decoder8', 'encoder4_decoder8', 'encoder8_decoder8', 'encoder8_decoder1', 'encoder8_decoder2', 'encoder8_decoder4', 'raw_context', 'shared_transformer']])],
         notes=[]),
]


def show(repo, sha, path):
    out = subprocess.run(['git', '-C', repo, 'show', f'{sha}:{path}'], capture_output=True, text=True)
    if out.returncode:
        sys.exit(f'missing at {sha}: {path}\n{out.stderr}')
    return out.stdout


def top_block(text, key):
    lines, out, on = text.splitlines(), [], False
    for ln in lines:
        if re.match(r'^\S', ln):
            on = ln.startswith(f'{key}:')
        if on:
            out.append(ln)
    if not out:
        sys.exit(f'no top-level key {key}')
    return out


def nested_block(text, dotted):
    parent, child = dotted.split('.')
    block = top_block(text, parent)
    out, on = [], False
    for ln in block[1:]:
        ind = len(ln) - len(ln.lstrip())
        if ind == 2 and ln.strip():
            on = ln.strip().startswith(f'{child}:')
        if on:
            out.append(ln)
    if not out:
        sys.exit(f'no key {dotted}')
    return [f'{parent}:'] + out


def excerpt(text, keys, nested):
    parts = [top_block(text, k) for k in keys] + [nested_block(text, d) for d in nested]
    n = len(text.splitlines())
    head = f'# Excerpt: {", ".join(keys + nested)} ({n} lines in full; the rest sets W&B, Ray resources,\n# the three native/EB sampler policies and Hydra output paths).'
    return head + '\n' + '\n'.join('\n'.join(p) for p in parts) + '\n'


def run_block(readme, section=None):
    pat = re.compile(r'^## (.+)$', re.M)
    heads = [(m.start(), m.group(1).strip()) for m in pat.finditer(readme)]
    want = [section] if section else ['Running it', 'Run']
    for i, (pos, title) in enumerate(heads):
        if title in want:
            end = heads[i + 1][0] if i + 1 < len(heads) else len(readme)
            blocks = re.findall(r'```bash\n(.*?)```', readme[pos:end], re.S)
            if blocks:
                return '\n'.join(b.rstrip() + '\n' for b in blocks)
    sys.exit(f'no run section {want}')


def axes(sweep_text, override=None):
    params = yaml.safe_load(sweep_text)['hydra']['sweeper']['params']
    rows = []
    for key, vals in params.items():
        if key.startswith(('~', '++', '+')) or key == 'seed':
            continue
        label, names = (override or {}).get(key, (AXIS_LABEL.get(key), NAMES.get(key)))
        if names is None:
            sys.exit(f'no plain name for axis {key}')
        vs = [v.strip() for v in str(vals).split(',')]
        missing = [v for v in vs if v not in names]
        if missing:
            sys.exit(f'no plain name for {key}={missing}')
        rows.append(dict(axis=label, key=key, values=[dict(name=names[v], value=v) for v in vs]))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('repo')
    ap.add_argument('--sha', required=True)
    ap.add_argument('--github', required=True, help='repo URL, e.g. https://github.com/OWNER/sddc')
    a = ap.parse_args()
    sha = subprocess.run(['git', '-C', a.repo, 'rev-parse', a.sha], capture_output=True, text=True, check=True).stdout.strip()
    blob = lambda p: f'{a.github}/blob/{sha}/{p}'
    out = dict(sha=sha, short=sha[:7], github=a.github, questions=[])
    for s in SPEC:
        q = dict(id=s['id'], question=s['question'], dir=s['dir'], dir_url=f'{a.github}/tree/{sha}/{s["dir"]}',
                 run=run_block(show(a.repo, sha, f'{s["dir"]}/README.md'), s.get('readme_section')),
                 fixed=s['fixed'], notes=s['notes'], see=s.get('see'), axes=[], sweep=None, groups=[])
        if 'sweep' in s:
            text = show(a.repo, sha, s['sweep'])
            q['axes'] = axes(text, s.get('names'))
            q['sweep'] = dict(path=s['sweep'], url=blob(s['sweep']), text=text)
        for label, files in s.get('groups', []):
            g = []
            for f in files:
                if isinstance(f, tuple):
                    path, keys, nested = f
                    g.append(dict(path=path, url=blob(path), text=excerpt(show(a.repo, sha, path), keys, nested), excerpt=True))
                else:
                    g.append(dict(path=f, url=blob(f), text=show(a.repo, sha, f)))
            q['groups'].append(dict(label=label, files=g))
        out['questions'].append(q)
    json.dump(out, sys.stdout, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
