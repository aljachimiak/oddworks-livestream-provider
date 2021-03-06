'use strict';

const Promise = require('bluebird');

module.exports = (bus, client, transform) => {
	//
	// Attached to the oddcast command handler for
	//  {role: 'provider', cmd: 'get', source: 'livestream-video'}
	//
	// Will recieve:
	// - args.spec - The specification object
	// - args.object - The resource object
	//
	// The specification object is expected to have 2 parts
	// - spec.event - A shell for a Livestream event object with minimally: `{id: "STRING"}`
	// - spec.video - Optionally used to check for VOD content: `{id: "STRING"}`
	//
	function fetchVideo(args) {
		const channel = args.channel;
		const secrets = (channel.secrets || {}).livestream || {};
		const apiKey = secrets.apiKey;
		const accountId = secrets.accountId;
		const clientId = secrets.clientId;
		const spec = args.spec;
		const event = spec.event || {};
		const video = spec.video || {};

		if (!apiKey || !accountId || !clientId) {
			bus.broadcast({level: 'warn'}, {
				message: `Skipping Livestream fetchVideo due to missing credentials in channel ${channel.id}`
			});
			return Promise.resolve(null);
		}

		if (!event.id) {
			bus.broadcast({level: 'error'}, {
				message: `Livestream fetchVideo requires an event ID. channel: ${channel.id}`
			});
			return Promise.resolve(null);
		}

		if (!video.id) {
			bus.broadcast({level: 'error'}, {
				message: `Livestream fetchVideo requires a video ID. channel: ${channel.id}`
			});
			return Promise.resolve(null);
		}

		const params = {
			apiKey, accountId, clientId,
			eventId: event.id,
			id: video.id
		};

		return client.getVideo(params).then(res => {
			if (!res) {
				const message = `Video not found for event id "${params.eventId}" video id "${params.id}"`;
				bus.broadcast({level: 'error'}, {
					code: `VIDEO_NOT_FOUND`,
					message: `video not found`,
					spec
				});
				return Promise.reject(new Error(message));
			}

			// Credentials needs to be passed into the transform to sign the stream URL.
			res.creds = {apiKey: params.apiKey, accountId: params.accountId, clientId: params.clientId};
			return transform(spec, res);
		});
	}

	return fetchVideo;
};
